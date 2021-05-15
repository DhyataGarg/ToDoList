require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const _ = require("lodash");
const date = require(__dirname + "/date.js");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const cors = require("cors");

///////////////////////////////***************************//////////////////////////////////

const app = express();
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

///////////////////////////////***************************//////////////////////////////////

mongoose.connect("mongodb://localhost:27017/mytodolistDB", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

mongoose.set("useCreateIndex", true);

///////////////////////////////***************************//////////////////////////////////

const itemSchema = new mongoose.Schema({
  name: String,
});

const item1 = {
  name: "Welcome to your ToDoList.",
};

const item2 = {
  name: "Hit + button to add a new item.",
};

const item3 = {
  name: "<-- Hit this to delete an item.",
};

const defaultItems = [item1, item2, item3];

///////////////////////////////***************************//////////////////////////////////

const listSchema = new mongoose.Schema({
  name: String,
  items: [itemSchema],
});

///////////////////////////////***************************//////////////////////////////////

const userSchema = new mongoose.Schema({
  username: String,
  firstName: String,
  lastName: String,
  password: String,
  lists: [listSchema],
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

///////////////////////////////***************************//////////////////////////////////

app.get("/", (req, res) => {
  res.render("homepage");
});

///////////////////////////////***************************//////////////////////////////////

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.post("/signup", function (req, res) {
  User.register(
    {
      firstName: req.body.userFirstName,
      lastName: req.body.userLastName,
      username: req.body.username,
    },
    req.body.password,
    (err, user) => {
      if (err) {
        console.log(`User Registration Through Passport Error: \n\t${err}`);
        res.redirect("/500");
      } else {
        passport.authenticate("local")(req, res, () => {
          res.redirect("/lists/today");
        });
      }
    }
  );
});

///////////////////////////////***************************//////////////////////////////////

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });
  req.login(user, function (err) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, () => {
        res.redirect("/lists/today");
      });
    }
  });
});

///////////////////////////////***************************//////////////////////////////////

app.get("/lists/today", function (req, res) {
  if (req.isAuthenticated()) {
    const user = req.user;

    User.findById(user._id).then((result) => {
      const lists = user.lists;
      if (lists.length === 0) {
        User.updateOne(
          { _id: user._id },
          {
            $push: {
              lists: { name: "Today", items: defaultItems },
            },
          },
          function (err, result) {
            if (err) {
              res.send(err);
            } else {
              console.log("Successfully modified.");
            }
          }
        );
        res.redirect("/lists/today");
      } else {
        // lists.forEach((list) => {
        // if (list.name === "Today") {
        res.render("list", {
          listName: "Today",
          listTitle: date(),
          userLists: lists,
          listItems: lists[0].items,
        });
      }
      // });
      // }
    });
  } else {
    res.redirect("/login");
  }
});

app.post("/lists/today", function (req, res) {
  const user = req.user;
  const itemName = req.body.newItem;
  const listName = _.capitalize(req.body.list);

  if (itemName.trim().length > 0) {
    User.updateOne(
      { _id: req.user._id },
      {
        $push: { "lists.$[list].items": { name: itemName } },
      },
      {
        arrayFilters: [{ "list.name": { $eq: listName } }],
      },
      (err, result) => {
        if (err) {
          console.log(err);
        } else {
          console.log("Successfully updated");
        }
      }
    );
  }
  res.redirect(`/lists/${listName}`);
});

///////////////////////////////***************************//////////////////////////////////

app.get("/lists", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/lists/today");
  } else {
    res.redirect("/login");
  }
});

app.post("/lists", (req, res) => {
  const newListName = req.body.newListName;
  var listAlreadyExists = false;

  User.findById(req.user._id, (err, foundUser) => {
    foundUser.lists.forEach((list) => {
      if (list.name == _.capitalize(newListName.trim())) {
        listAlreadyExists = true;
      }
    });

    if (newListName.trim().length > 0) {
      if (!listAlreadyExists) {
        User.updateOne(
          { _id: req.user._id },
          {
            $push: {
              lists: {
                name: _.capitalize(newListName.trim()),
                items: defaultItems,
              },
            },
          },
          function (err, result) {
            if (err) {
              res.send(err);
            } else {
              console.log("Successfully added the list.");
            }
          }
        );
      }

      setTimeout(() => {
        res.redirect(`/lists/${_.capitalize(newListName.trim())}`);
      }, 1000);
    } else {
      res.redirect("/lists/today");
    }
  });
});

///////////////////////////////***************************//////////////////////////////////

app.get("/lists/:listName", (req, res) => {
  if (req.isAuthenticated()) {
    const lists = req.user.lists;
    const foundList = lists.find((list) => list.name === req.params.listName);
    console.log(foundList);

    if (!foundList) {
      console.log("No list found.");
      res.redirect(`/lists/Today`);
    } else if (foundList.items.length === 0) {
      User.updateOne(
        { _id: req.user._id },
        {
          $pull: { lists: { name: foundList.name } },
        },
        function (err, result) {
          if (err) {
            res.send(err);
          } else {
            console.log("Successfully modified.");
          }
        }
      );
      res.redirect("/lists/Today");
    } else {
      if (_.capitalize(foundList.name) === "Today") {
        res.render("list", {
          listName: "Today",
          listTitle: date(),
          userLists: lists,
          listItems: foundList.items,
        });
      } else {
        res.render("list", {
          listName: foundList.name,
          listTitle: foundList.name,
          userLists: lists,
          listItems: foundList.items,
        });
      }
    }
  } else {
    res.redirect("/login");
  }
});

///////////////////////////////***************************//////////////////////////////////

app.post("/search", (req, res) => {
  const searchList = _.capitalize(req.body.searchList).trim();
  res.redirect(`/lists/${searchList}`);
});

///////////////////////////////***************************//////////////////////////////////

app.post("/delete", (req, res) => {
  const checkedItemId = req.body.checkbox;
  const listName = req.body.listName;

  User.updateOne(
    { _id: req.user._id },
    {
      $pull: { "lists.$[list].items": { _id: checkedItemId } },
    },
    {
      arrayFilters: [{ "list.name": { $eq: listName } }],
    },
    (err, result) => {
      if (err) {
        console.log(err);
      } else {
        console.log("Successfully deleted");
      }
    }
  ).then(res.redirect(`/lists/${listName}`));
});

///////////////////////////////***************************//////////////////////////////////
app.post("/logout", (req, res) => {
  req.logout();
  req.session.destroy();
  res.redirect("/");
});

///////////////////////////////***************************//////////////////////////////////

app.get("/about", function (req, res) {
  res.render("about");
});

///////////////////////////////***************************//////////////////////////////////

app.listen(3000, function () {
  console.log("Server is running at port 3000.");
});

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
const sendEmail = require("./utils/sendEmail.js");
const otpGenerator = require("./utils/otpGenerator");

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

let otp = 0;
let userDetails = {};

const app = express();
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));
app.use(cors());
mongoose.set("useFindAndModify", false);

app.use(
  session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

mongoose.connect(
  `mongodb+srv://${process.env.MONGO_USER_NAME}:${process.env.MONGO_PASSWORD}@mytodolist.yccci.mongodb.net/mytodolistDB`,
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

mongoose.set("useCreateIndex", true);

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const listSchema = new mongoose.Schema({
  name: String,
  items: [itemSchema],
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const userSchema = new mongoose.Schema({
  firstName: String,
  lastName: String,
  username: String,
  password: String,
  lists: [listSchema],
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.post("/sendemail", (req, res) => {
  (userDetails = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    username: req.body.username,
    password: req.body.password,
  }),
    otp = otpGenerator();

  const from = "dhyatagarg09@gmail.com";
  const to = req.body.username;
  const subject = "Verification for My ToDoList";
  const output = `<p>Hello ${req.body.firstName} ${req.body.lastName}, Thank You for registering on <b>My ToDoList</b>.</p><p>Use <span style="font-weight: bold; color: red; font-size: 1.5rem;">${otp}</span> as OTP for Verifying your email ID.</p><p>This OTP is unique to you, so please do not share it to anyone else.</p><p></p><p></p><p></p><p>If you have not Registered on My ToDoList, then feel free to ignore this mail.</p>`;

  sendEmail(to, from, subject, output);
  console.log(output)
  res.redirect("/verify");
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.get("/verify", (req, res) => {
  res.render("verify", {
    username: userDetails.username,
    password: userDetails.password,
  });
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.get("/", (req, res) => {
  res.redirect("/signup");
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.post("/signup", function (req, res) {
  if (req.body.OTP == otp) {
    User.register(
      {
        firstName: userDetails.firstName,
        lastName: userDetails.lastName,
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
  } else {
res.send('<script>alert("Wrong OTP")</script>')  }
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.get("/lists/today", function (req, res) {
  if (req.isAuthenticated()) {
    const user = req.user;

    User.findById(user._id).then((result) => {
      var lists = user.lists;
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
        res.render("list", {
          listName: "Today",
          listTitle: date(),
          userLists: lists,
          listItems: lists[0].items,
        });
      }
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
        }
      }
    );
  }
  res.redirect(`/lists/${listName}`);
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.get("/lists/:listName", (req, res) => {
  if (req.isAuthenticated()) {
    const lists = req.user.lists;
    const foundList = lists.find((list) => list.name === req.params.listName);

    if (!foundList) {
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

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.post("/search", (req, res) => {
  const searchList = _.capitalize(req.body.searchList).trim();
  res.redirect(`/lists/${searchList}`);
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
      }
    }
  );
  setTimeout(() => {
    res.redirect(`/lists/${listName}`);
  }, 250);
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.post("/deleteAccount", (req, res) => {
  async function deleteUser() {
    User.findByIdAndRemove(req.user._id, function (err, docs) {
      if (err) {
        console.log(err);
      }
    });
  }
  deleteUser().then(res.redirect(`/`));
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
app.post("/logout", (req, res) => {
  req.logout();
  req.session.destroy();
  res.redirect("/login");
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

app.get("/about", function (req, res) {
  res.render("about");
});

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const port = process.env.PORT || 4000;


app.listen(port, function () {
  console.log("Server has started successfully. "+ port);
});



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
          res.redirect("/today");
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
        res.redirect("/today");
      });
    }
  });
});

///////////////////////////////***************************//////////////////////////////////

app.get("/today", function (req, res) {
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
        res.redirect("/today");
      } else {
        lists.forEach((list) => {
          if (list.name === "Today") {
            res.render("list", {
              listTitle: date(),
              userLists: lists,
              listItems: list.items,
            });
          }
        });
      }
    });
  } else {
    res.redirect("/login");
  }
});

// app.post("/today", function (req, res) {
//   const user = req.user;
//   const itemName = req.body.newItem;
//   const listName = req.body.list;

//   const listInd = user.lists.findIndex((list) => list.name === listName);
//   User.updateOne(
//     { _id: req.user._id },
//     {
//       $push: {
//         lists: [
//           ...user.lists,
//           {
//             name: _.capitalize(listName.trim()),
//             items: [...user.lists[listInd].items, { name: itemName }],
//           },
//         ],
//       },
//     },

//     (err, result) => {
//       if (err) {
//         console.log(err);
//       } else {
//         console.log("Successfully updated");
//       }
//     }
//   );
//   console.log(user.lists[listInd]);

//   res.redirect("/today");
// });

///////////////////////////////***************************//////////////////////////////////

// app.get("/:customListName", function (req, res) {
//   const customListName = (req.params.customListName);

//   List.findOne({ name: customListName }, (err, foundList) => {
//     if (!err) {
//       if (!foundList) {
//         //Create a new list
//         const list = new List({
//           name: customListName,
//           items: defaultItems,
//         });
//         list.save();
//         res.redirect("/" + customListName);
//       } else {
//         //Show an existing list
//         res.render("list", {
//           listTitle: foundList.name,
//           newListItems: foundList.items,
//         });
//       }
//     }
//   });
// });

///////////////////////////////***************************//////////////////////////////////

app.get("/lists", (req, res) => {
  if (req.isAuthenticated()) {
    res.redirect("/today");
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
      res.redirect("/today");
    }
  });
});

///////////////////////////////***************************//////////////////////////////////

app.get("/lists/:listName", (req, res) => {
  if (req.isAuthenticated()) {
    const lists = req.user.lists;
    const foundList = lists.find((list) => list.name === req.params.listName);
    if (foundList.name === "Today") {
      res.render("list", {
        listTitle: date(),
        userLists: lists,
        listItems: foundList.items,
      });
    } else {
      res.render("list", {
        listTitle: foundList.name,
        userLists: lists,
        listItems: foundList.items,
      });
    }
    // });
  } else {
    res.redirect("/login");
  }
});

///////////////////////////////***************************//////////////////////////////////

// app.post("/delete", (req, res) => {
//   const checkedItemId = req.body.checkbox;
//   const listName = req.body.listName;

//   if (listName === date()) {
//     Item.findByIdAndRemove(checkedItemId, (err) => {
//       if (err) {
//         console.log(err);
//       } else {
//         console.log("Successfully deleted.");
//       }
//     });
//     res.redirect("/Today");
//   } else {
//     List.findOneAndUpdate(
//       { name: listName },
//       { $pull: { items: { _id: checkedItemId } } },
//       (err, foundList) => {
//         if (!err) {
//           res.redirect("/" + listName);
//         }
//       }
//     );
//   }
// });

///////////////////////////////***************************//////////////////////////////////

app.get("/about", function (req, res) {
  res.render("about");
});

///////////////////////////////***************************//////////////////////////////////

app.listen(3000, function () {
  console.log("Server is running at port 3000.");
});

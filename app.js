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

const Item = mongoose.model("Item", itemSchema);

const item1 = new Item({
  name: "Welcome to your ToDoList.",
});

const item2 = new Item({
  name: "Hit + button to add a new item.",
});

const item3 = new Item({
  name: "<-- Hit this to delete an item.",
});

const defaultItems = [item1, item2, item3];

///////////////////////////////***************************//////////////////////////////////

const listSchema = new mongoose.Schema({
  name: String,
  items: [itemSchema],
});

const List = mongoose.model("List", listSchema);

///////////////////////////////***************************//////////////////////////////////

// const allListsSchema = new mongoose.Schema({
//   lists: Array,
// });

// const AllLists = mongoose.model("AllList", allListsSchema);

///////////////////////////////***************************//////////////////////////////////

const userSchema = new mongoose.Schema({
  username: String,
  firstName: String,
  lastName: String,
  password: String,
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

// app.post("/", (req, res) => {});

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

  const item = Item.find({}, (err, foundItems) => {
    if (foundItems.length === 0) {
      Item.insertMany(defaultItems, (err) => {
        if (err) {
          console.log(err);
        } else {
          console.log("Successfully inserted.");
        }
        res.redirect("/today");
      });
    } else {
      res.render("list", { listTitle: date(), newListItems: foundItems});
    }
  });
});

app.post("/today", function (req, res) {
  const itemName = req.body.newItem;
  const listName = req.body.list;
  const item = new Item({
    name: itemName,
  });

  if (listName === date()) {
    item.save();
    res.redirect("/today");
  } else {
    List.findOne({ name: listName }, (err, foundList) => {
      foundList.items.push(item);
      foundList.save();
      res.redirect("/" + listName);
    });
  }
});

///////////////////////////////***************************//////////////////////////////////

app.get("/:customListName", function (req, res) {
  const customListName = _.capitalize(req.params.customListName);

  List.findOne({ name: customListName }, (err, foundList) => {
    if (!err) {
      if (!foundList) {
        //Create a new list
        const list = new List({
          name: customListName,
          items: defaultItems,
        });
        list.save();
        res.redirect("/" + customListName);
      } else {
        //Show an existing list
        res.render("list", {
          listTitle: foundList.name,
          newListItems: foundList.items,
        });
      }
    }
  });
});

///////////////////////////////***************************//////////////////////////////////

app.post("/delete", (req, res) => {
  const checkedItemId = req.body.checkbox;
  const listName = req.body.listName;

  if (listName === date()) {
    Item.findByIdAndRemove(checkedItemId, (err) => {
      if (err) {
        console.log(err);
      } else {
        console.log("Successfully deleted.");
      }
    });
    res.redirect("/Today");
  } else {
    List.findOneAndUpdate(
      { name: listName },
      { $pull: { items: { _id: checkedItemId } } },
      (err, foundList) => {
        if (!err) {
          res.redirect("/" + listName);
        }
      }
    );
  }
});

///////////////////////////////***************************//////////////////////////////////

app.get("/about", function (req, res) {
  res.render("about");
});

///////////////////////////////***************************//////////////////////////////////

app.listen(3000, function () {
  console.log("Server is running at port 3000.");
});

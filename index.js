const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const { MongoClient, ObjectId } = require("mongodb");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const generateToken = require("./utils/genarateToken");

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: "*", credentials: true }));
app.use(express.json());

// MongoDB Connection URL
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function run() {
  try {
    // Connect to MongoDB
    await client.connect();
    console.log("Connected to MongoDB");

    const db = client.db("assignment");
    const collection = db.collection("users");
    const donations = db.collection("donations");
    const testimonial = db.collection("testimonial");
    const volunteer = db.collection("volunteer");
    const community = db.collection("community");

    // User Registration
    app.post("/api/v1/register", async (req, res) => {
      const { name, email, password, image, location } = req.body;

      // Check if email already exists
      const existingUser = await collection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists",
        });
      }

      // Hash the password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Insert user into the database
      await collection.insertOne({
        name,
        email,
        image,
        location,
        password: hashedPassword,
      });

      // Generate JWT token
      const token = generateToken(email);

      res.status(201).json({
        success: true,
        message: "User registered successfully",
        token,
        user: {
          name,
          email,
          image,
          location,
        },
      });
    });

    // User Login
    app.post("/api/v1/login", async (req, res) => {
      const { email, password } = req.body;

      // Find user by email
      const user = await collection.findOne({ email });
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Compare hashed password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Generate JWT token
      const token = generateToken(user.email);

      res.json({
        success: true,
        message: "Login successful",
        token,
        user: {
          name: user.name,
          email,
        },
      });
    });

    // create donation post
    app.post("/api/v1/create-donation", async (req, res) => {
      const result = await donations.insertOne(req.body);

      if (result.acknowledged) {
        res.json({
          success: true,
          message: "Donation created successfully.",
          donation: req.body,
        });
      } else {
        res.json({
          success: false,
          message: "Something went wrong.",
        });
      }
    });

    // get all donation posts
    app.get("/api/v1/all-donation", async (req, res) => {
      const limit = Number(req.query.limit);

      if (!limit) {
        const result = await donations.find({}).sort({ _id: -1 }).toArray();
      }

      const result = await donations
        .find({})
        .sort({ _id: -1 })
        .limit(limit)
        .toArray();

      res.json({
        success: true,
        message: "Donation fetched successfully.",
        data: result,
      });
    });

    // get all donation posts for dashboard
    app.get("/api/v1/admin/donation", async (req, res) => {
      let totalAverage = 0;
      let totalDonation = 0;
      const categoryTotals = {}; // Object to store accumulated amounts for each category

      const totalDoc = await donations.estimatedDocumentCount();

      const result = await donations.find({}).sort({ amount: -1 }).toArray();
      const users = await collection.estimatedDocumentCount();

      result.forEach((item) => {
        totalDonation = Number(item.amount) + totalDonation;
        totalAverage = Math.ceil(totalDonation / totalDoc);

        if (!categoryTotals[item.category]) {
          categoryTotals[item.category] = 0;
        }

        categoryTotals[item.category] =
          categoryTotals[item.category] + Number(item.amount);
      });

      // category total donation
      const categoryArray = Object.keys(categoryTotals).map((category) => ({
        title: category,
        value: categoryTotals[category],
      }));

      const additionalData = [
        { id: 1, title: "Total Users", value: users },
        { id: 2, title: "Total Donor", value: totalDoc },
        { id: 3, title: "Total Donation", value: totalDonation },
        { id: 4, title: "Average Donation", value: totalAverage },
      ];

      res.json({
        success: true,
        message: "Donation fetched successfully.",
        additionalData,
        categoryTotals: categoryArray,
        data: result,
      });
    });

    // get a donation post
    app.get("/api/v1/all-donation/:id", async (req, res) => {
      const id = new ObjectId(req.params.id);
      const result = await donations.findOne({ _id: id });

      res.json({
        success: true,
        message: "Donation fetched successfully.",
        data: result,
      });
    });

    app.put("/api/v1/all-donation/:id", async (req, res) => {
      const id = new ObjectId(req.params.id);
      const query = { _id: id };
      const option = { upsert: true };
      const updatedDoc = {
        $set: req.body,
      };

      const donation = await donations.findOne({ _id: id });

      if (!donation) {
        res.json({
          success: false,
          message: "This donation post is not exists.",
          data: donation,
        });
      }

      const result = await donations.updateOne(query, updatedDoc, option);

      res.json({
        success: true,
        message: "Donation updated successfully.",
      });
    });

    // delete a donation post
    app.delete("/api/v1/all-donation/:id", async (req, res) => {
      const id = new ObjectId(req.params.id);

      const donation = await donations.findOne({ _id: id });

      if (!donation) {
        res.json({
          success: false,
          message: "This donation post is not exists.",
          data: donation,
        });
      }
      const result = await donations.deleteOne({ _id: id });

      if (!result.acknowledged) {
        res.json({
          success: false,
          message: "Something went wrong while deleting this post.",
          data: donation,
        });
      }

      res.json({
        success: true,
        message: "Donation deleted successfully.",
        data: donation,
      });
    });

    // get all testimonial
    app.get("/api/v1/testimonials", async (req, res) => {
      const limit = Number(req.query.limit);

      if (!limit) {
        const result = await testimonial
          .find({})
          .sort({ donation_amount: -1 })
          .toArray();
      }
      const result = await testimonial
        .find({})
        .sort({ donation_amount: -1 })
        .limit(limit)
        .toArray();

      res.json({
        success: true,
        message: "Testimonials fetched successfully.",
        data: result,
      });
    });

    // create testimonial
    app.post("/api/v1/testimonial", async (req, res) => {
      const result = await testimonial.insertOne(req.body);

      if (result.acknowledged) {
        res.json({
          success: true,
          message: "Testimonial created successfully.",
        });
      } else {
        res.json({
          success: false,
          message: "Something went wrong.",
        });
      }
    });

    // create volunteer
    app.post("/api/v1/volunteer", async (req, res) => {
      const result = await volunteer.insertOne(req.body);

      if (result.acknowledged) {
        res.json({
          success: true,
          message: "Application applied successfully.",
        });
      } else {
        res.json({
          success: false,
          message: "Something went wrong.",
        });
      }
    });

    // get all volunteer post
    app.get("/api/v1/volunteer", async (req, res) => {
      const result = await volunteer.find().sort({ _id: 1 }).toArray();

      res.json({
        success: true,
        message: "Volunteers fetched successfully.",
        data: result,
      });
    });

    // get a volunteer post
    app.get("/api/v1/volunteer/:id", async (req, res) => {
      const { id } = req.params;
      const result = await volunteer.findOne({ _id: new ObjectId(id) });

      res.json({
        success: true,
        message: "Volunteer fetched successfully.",
        data: result,
      });
    });

    // get all community posts
    app.get("/api/v1/community", async (req, res) => {
      const result = await community.find({}).sort({ _id: -1 }).toArray();

      res.json({
        success: true,
        message: "Community posts fetched successfully.",
        data: result,
      });
    });

    // add community post comment
    app.put("/api/v1/community/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const option = { upsert: true };

      const updatedComment = req.body;

      const post = await community.findOne(query);

      if (!post) {
        return res.send({
          success: false,
          message: "This post is invalid.",
        });
      }

      let comments = []; // Initialize comments as an empty array

      if (post.comments && Array.isArray(post.comments)) {
        comments = [...post.comments, updatedComment];
      } else {
        comments = [updatedComment];
      }

      const updatedDoc = {
        $set: {
          comments: comments,
        },
      };

      const result = await community.updateOne(query, updatedDoc, option);

      res.json({
        success: true,
        message: "Community post updated successfully.",
        data: post, // Return the updated document
      });
    });

    // Start the server
    app.listen(port, () => {
      console.log(`Server is running on http://localhost:${port}`);
    });
  } finally {
  }
}

run().catch(console.dir);

// Test route
app.get("/", (req, res) => {
  const serverStatus = {
    message: "Server is running smoothly",
    timestamp: new Date(),
  };
  res.json(serverStatus);
});

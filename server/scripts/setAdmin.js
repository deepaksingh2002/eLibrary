require("dotenv").config();
const mongoose = require("mongoose");

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const res = await mongoose.connection.collection("users").updateOne(
    { email: "testdebug2@test.com" },
    { $set: { role: "admin" } }
  );
  console.log("Modified:", res.modifiedCount, "— user is now admin");
  await mongoose.disconnect();
}).catch(err => { console.error(err); process.exit(1); });

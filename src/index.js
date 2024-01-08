import dotenv from "dotenv";
import connectToDB from "./db/index.js";
import { app } from "./app.js";

dotenv.config({
  path: "./env",
});

connectToDB()
  .then(() => {
    app.listen(process.env.PORT || 8000, () => {
      console.log(`server is running at ${process.env.PORT}`);
    });
  })
  .catch((error) => {
    console.log("Mongodb Connection Error::: " + error);
  });

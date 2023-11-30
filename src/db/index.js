import mongoose from "mongoose";
import { DB_NAME } from "../constanats";

const connectToDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.MONGODB_URI}/${DB_NAME}`
    );
    console.log(
      `\n mongoDB connected  DB HOst :: ${connectionInstance.connection.host}`
    );
  } catch (error) {
    console.log("mongoDb connection failed", error);
    process.exit(1);
  }
};

export default connectToDB;

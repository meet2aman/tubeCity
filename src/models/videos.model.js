import mongoose from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const videoSchema = new mongoose.Schema(
  {
    videoFile: {
      type: String, // cloudinary video file
      required: [true, "Video File is Required"],
    },
    thumbnail: {
      type: String, /// cloudinary video file
      required: [true, "Thumbnail is Required"],
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
    },
    title: {
      type: String,
      required: [true, "Title is Required"],
    },
    description: {
      type: String,
      required: [true, "Description is Required"],
    },
    duration: {
      type: Number,
      required: true,
    },
    views: {
      type: Number,
      default: 0,
    },
    isPublished: {
      type: Boolean,
      required: true,
      default: true,
    },
  },
  { timeStamps: true }
);

videoSchema.plugin(mongooseAggregatePaginate);

export const Video = mongoose.model("Video", videoSchema);

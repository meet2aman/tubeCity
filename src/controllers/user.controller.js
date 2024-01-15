import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

///////////// generation tokens which calling by login controller ////////////
const generateAccessAndRefreshToken = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating referesh and access token"
    );
  }
};

///////////// REGISTER CONTROLLER ////////////
const registerUser = asyncHandler(async (req, res) => {
  // destructuring the body to get Data
  const { username, email, fullName, password } = req.body;

  // if  any of the data missing
  if (
    [fullName, email, password, username].some((field) => {
      field?.trim() === "";
    })
  ) {
    throw new ApiError(400, "All fields are required");
  }

  // checking user existed from above data coming from request
  const existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  // if existed
  if (existedUser) throw new ApiError(409, "user already exists");

  // getting local path of images which is /public/temp
  const avatarLocalPath = req.files?.avatar[0]?.path;
  console.log("path:: ", avatarLocalPath);

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  // if no local path of images found
  if (!avatarLocalPath) throw new ApiError(400, "Missing avatar-1");

  // if path found then upload on cloudinary and getting url
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) throw new ApiError(400, "Missing avatar-2");

  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    password,
    email,
    username: username.toLowerCase(),
  });

  // creating user in mongoDb
  const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  // if failed user creation somehow
  if (!createdUser)
    throw new ApiError(500, "Something went wrong while registering the user");

  // if everything is fine sending res with data
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registration successful"));
});

///////////// LOGIN CONTROLLER ////////////
const loginUser = asyncHandler(async (req, res) => {
  // getting data from request
  const { email, username, password } = req.body;

  // checking all required fields data is available
  if (!(email || username)) {
    throw new ApiError(400, "Username or Email is required");
  }

  // finding user exits or not
  const user = await User.findOne({
    $or: [{ email }, { username }],
  });

  // console.log(user);

  // if not found
  if (!user) {
    throw new ApiError(404, "User does not Exist");
  }

  // checking password is correct or not
  const isPasswordValid = await user.isPasswordCorrect(password);

  // if password is not correct
  if (!isPasswordValid) {
    throw new ApiError(401, "Password is not correct");
  }

  // generating tokens
  const { accessToken, refreshToken } = await generateAccessAndRefreshToken(
    user._id
  );

  // getting updated user information with tokens

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );
  console.log(loggedInUser);

  //sending token through cookies
  const options = {
    httpOnly: true,
    secure: true,
  };
  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "user loggedIn successfully"
      )
    );
});

///////////// LOGOUT CONTROLLER ////////////
const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});

///////////// REFRESH_ACCESSS_TOKEN CONTROLLER ////////////
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "unauthorized access token");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid Refresh token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token has been expired or used");
    }

    const options = {
      httpOnly: true,
      secure: true,
    };

    const { accessToken, newRefreshToken } =
      await generateAccessAndRefreshToken(user._id);

    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "accesstoken refreshed successfully"
        )
      );
  } catch (error) {
    throw new ApiError(400, error?.message || "invalid refreshToken");
  }
});

///////////// LOGOUT CONTROLLER ////////////
const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword, confirmPassword } = req.body;
  if (!(newPassword !== confirmPassword)) {
    throw new ApiError(400, "New password and confirm Password does not match");
  }

  const user = await User.findById(req.user?._id);
  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Old Password is incorrect");
  }

  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password updated successfully"));
});

///////////// GET_CURRENT_USER CONTROLLER ////////////
const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(200, req.user, "Current User fetched successfully");
});

///////////// UPDATE_ACCOUNT_DETAILS CONTROLLER ////////////
const updateAccountDetails = asyncHandler(async (req, res) => {
  const { email, fullName } = req.body;

  if (!fullName || !email) {
    throw new ApiError(400, "All fields are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
      },
    },
    { new: true }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully"));
});

/////////////   UPDATE_AVATAR CONTROLLER  ////////////
const updateUserAvatar = asyncHandler(async (req, res) => {
  const avatarLocalPath = request.file?.path;
  if (!avatarLocalPath) throw new ApiError(400, "No File Path provided");
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  if (!avatar.url) throw new ApiError(400, "Error While Uploading avatar");

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: avatar.url,
      },
    },
    { new: true }.select("-password")
  );
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully"));
});

/////////////   UPDATE_COVER_IMAGE CONTROLLER  ////////////
const updateUserCoverImage = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;
  if (!coverImageLocalPath)
    throw new ApiError(400, "Error in getting cover image");

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage.url)
    throw new ApiError(400, "Error while uploading cover image");

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: coverImage.url,
      },
    },
    { new: true }
  );
  return res
    .status(200)
    .json(new ApiResponse(200, user, "coverImage updated successfully"));
});

/////////////   GETTING CHANNEL DATA  CONTROLLER  ////////////
const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }
  const channel = await User.aggregate([
    // 1st pipeline
    {
      $match: { username: username?.toLowerCase() },
    },
    // 2nd pipeline
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    // 3rd pipeline
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    // 4th pipeline
    {
      $addFields: {
        subscribersCount: {
          $size: "$subscribers",
        },
        channelsSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    // 5th pipeline
    {
      $project: {
        fullName: 1,
        username: 1,
        subscribersCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
        email: 1,
      },
    },
  ]);
  if (!channel?.length) {
    throw new ApiError(400, "Channel does not exist");
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully")
    );
});

/////////////   GETTING WATCH HISTORY DATA  CONTROLLER  ////////////
const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "owner",
              },
            },
          },
        ],
      },
    },
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Data fetched succesfully and got all the data from server"
      )
    );
});

/////////////    EXPORTS   ////////////
export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  getUserChannelProfile,
  updateUserCoverImage,
  getWatchHistory,
};

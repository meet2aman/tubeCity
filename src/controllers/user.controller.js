import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

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

  console.log(user);

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
  console.log(accessToken, refreshToken);

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
      $set: {
        refreshToken: undefined,
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
export { registerUser, loginUser, logoutUser };

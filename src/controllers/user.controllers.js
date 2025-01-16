import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js"
import { ApiResponse } from "../utils/ApiResponse.js"
import { User } from "../models/user.models.js"
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js"
import jwt from 'jsonwebtoken';
import {options} from '../contants.js';

const generateAccessAndRefreshToken = async (userId) => {
    const user = await User.findById(userId);
    try {

        if (!user) {
            console.error("Error while generating Tokens");
            throw new ApiError(501, "Error while generating Tokens")
            return null;
        }

        const accessToken =  await  user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken }

    } catch (error) {
        throw new ApiError(501, "Error while generating Tokens")
    }
}

const registerUser = asyncHandler(async (req, res) => {
    //Getting post fields
    const { fullname, email, username, password } = req.body


    //validation
    if (
        [fullname, email, username, password].some((field) => field?.trim() === "")
    ) {
        throw new ApiError(400, "All fields are required");
    }


    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists");
    }

    //Getting files

    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverLocalPath = req.files?.coverImage?.[0]?.path;

    // Avatar is required
    if (!avatarLocalPath) {
        throw new ApiError(400, "avatar file is missing");
    }

    // const avatar =  await uploadOnCloudinary(avatarLocalPath);
    // let coverImage = ""
    // if (coverLocalPath) {
    //     coverImage = await uploadOnCloudinary(coverLocalPath);
    // }

    let avatar;

    try {
        avatar = await uploadOnCloudinary(avatarLocalPath);

    } catch (error) {
        console.error("Error uploading avatar ", error);
        throw new ApiError(500, "Failed to upload avatar")
    }

    let coverImage;

    try {
        coverImage = await uploadOnCloudinary(coverLocalPath);

    } catch (error) {
        console.error("Error uploading coverImage ", error);
        throw new ApiError(500, "Failed to upload coverImage")
    }


    try {
        const user = await User.create({
            fullname,
            avatar: avatar.url,
            coverImage: coverImage?.url || "",
            email,
            password,
            username: username.toLowerCase()
        })


        //Verify user is added or not
        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken"
        );

        if (!createdUser) {
            throw new ApiError(500, "Something went wrong while registering user.")
        }


        return res
            .status(201)
            .json(new ApiResponse(200, createdUser, "User registered successfully"))

    } catch (error) {
        console.error("User creation failed");

        if (avatar) {
            deleteFromCloudinary(avatar.public_id);
        }
        if (coverImage) {
            deleteFromCloudinary(coverImage.public_id);
        }

        throw new ApiError(500, "Something went wrong while registering user and images were deleted")

    }
});


const loginUser = asyncHandler(async (req, res) => {
    // Get the data from body
    const { email, username, password } = req.body;

    //validation
    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    const user = await User.findOne({
        $or: [{ username }, { email }]
    })

    if (!user) {
        throw new ApiError(404, "User not found")
    }

    //validate password 
    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "invalid Credentials")
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshToken(user._id);


    const loggedInUser = await User.findById(user._id)
        .select("-password, -refreshToken");


    if (!loggedInUser) {
        console.log("Something went wrong while getting loggedInUser")
        throw new ApiError(500, "Something went wrogn, while getting loggedInUser")
    }

    const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200,
                { user: loggedInUser, accessToken, refreshToken },
                "User Logged in Successfully")
        )
})


const refreshAccessToken = asyncHandler(async (req, res) => {

    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, 'Refresh Token is Required');
    }


    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_EXPIRY
        )

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid Refresh Token")
        }

        if (incomingRefreshToken !== user.refreshAccessToken) {
            throw new ApiError(401, "Invalid Refresh Token")
        }

        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production"
        }

        const { accessToken, refreshToken: newRefreshToken } = await generateAccessAndRefreshToken(user._id);

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(200,
                    {
                        accessToken,
                        refreshToken: newRefreshToken
                    },
                    "Access token refreshed successfully"
                )
            )
    } catch (error) {
        throw new ApiError(500, "Something went wrong while refreshing token")
    }

})

const logoutUser = asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(
        req.user._id, 
        {
            $set: {
                refreshToken: undefined,
            }
        },
        {new: true}
    )

    return res 
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(
            new ApiResponse(200,
                {},
                "User logged out successfully"
            )
        )

})

const changeCurrentPassword = asyncHandler(async (req, res) => {

})

const updateAccountDetails = asyncHandler(async (req, res) => {

})

const updateUserCoverImage = asyncHandler(async(req, res) => {

})


const getUserChannelProfile = asyncHandler(async (req, res) => {
    const {username} = req.params;

    if(!username?.trim()) {
        throw new ApiError(400, "Username is required");
    }

    const channel = User.aggregate([
        {
            $match: {
                username: username?.toLowerCase(),
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo",
            },
        },
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers",
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo",
                },
                isSubscribed: {
                    $cond: {
                        if: {
                            $in: [req.user?._id, "$subscribers.subscriber"],
                        },
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            $project: {
                fullname: 1,
                username: 1,
                avatar: 1,
                subscriberCount: 1, // Fixed typo
                channelSubscribedToCount: 1,
                isSubscribed: 1,
                coverImage: 1,
                email: 1,
            },
        },
    ]);


    if(!channel?.length) {
        throw new ApiError(404, "Channel Not Found");
    }

    return res.status(200).json(new ApiResponse(200, 
        channel[0]), 
        "Channel profile fetched successfully")
})

const getWatchHistory = asyncHandler(async (req, res) => {
    const watchHistory = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?.id)
            }
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
                            as: "owner"
                        }
                    },
                    {
                        $addFields: {
                            owner: { $first: "$owner" }
                        }
                    },
                    {
                        $project: {
                            title: 1, // Example: Adjust based on fields in "videos"
                            description: 1,
                            owner: {
                                fullname: 1,
                                username: 1,
                                avatar: 1
                            }
                        }
                    }
                ]
            }
        }
    ]);

    if(!watchHistory) {
        throw new ApiError(404, "WatchHistory is not found")
    }

    return res
        .status(200) 
        .json(new ApiResponse(200, watchHistory[0], "Watchhistory fetched successfully"))
})


export {
    registerUser,
    loginUser,
    refreshAccessToken,
    logoutUser
}
import jwt from 'jsonwebtoken';
import {ApiError} from '../utils/ApiError.js';
import {ApiResponse} from '../utils/ApiResponse.js';
import {asyncHandler} from '../utils/asyncHandler.js';
import {User} from '../models/user.models.js'

export const verifyJWT = asyncHandler(async (req, _, next) => {
    const token = req.body.accessToken || req.body.accessToken || req.header("Authorization")?.("Bearer ", "");

    if(!token) {
        throw new ApiError(401, "Unauthorized");
    }

    try {
        const decodedToken = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

        const user = await User.findById(decodedToken?._id).select(
            "-password, -refreshToken"
        );

        if(!user) {
            throw  new ApiError(401, "Invalid Token");
        }

        req.user = user;

        next();
    }catch(error) {
        throw new ApiError(500, error?.message || "Something went wrong while verifying token")
    }
})
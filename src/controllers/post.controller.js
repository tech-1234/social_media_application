import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from "../utils/ApiError.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Post } from '../models/post.model.js';


const getAllPosts = asyncHandler(async (req, res) => {

})

const publishAPost = asyncHandler(async (req, res) => {
    const { caption } = req.body;
    if (!caption) throw new ApiError("Caption is required")
    const photoFileLocalPath = req.files?.photo[0]?.path;
    if (!photoFileLocalPath) throw new ApiError(400, "Photo is missing")
    const photo = await uploadOnCloudinary(photoFileLocalPath);
    if (!photo) throw new ApiError(400, "Something went wrong while upload this photo to cloudinary")

    const post = await Post.create({
        caption,
        photo: { publicId: photo?.public_id, url: photo?.url },
        owner: req.user?._id
    })

    return res
        .status(201)
        .json(
            new ApiResponse(
                201,
                {
                    ...post._doc,
                    photo: photo.url
                },
                "Post published successfully"
            )
        )
})

export {
    getAllPosts,
    publishAPost
}
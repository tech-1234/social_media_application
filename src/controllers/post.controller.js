import { asyncHandler } from '../utils/asyncHandler.js'
import { ApiError } from "../utils/ApiError.js";
import { deleteOnCloudinary, uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Post } from '../models/post.model.js';
import { User } from '../models/user.model.js';
import mongoose, { isValidObjectId } from 'mongoose';


const getAllPosts = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query = "", sortBy = "createdAt", sortType = 1, userId } = req.query;

    // Ensure sortType is a number
    const sortDirection = parseInt(sortType, 10);

    // Match condition for the aggregation pipeline
    const matchCondition = {
        $or: [
            { caption: { $regex: query, $options: "i" } },
        ]
    };

    if (userId) {
        matchCondition.owner = new mongoose.Types.ObjectId(userId);
    }
    let postAggregate;
    try {
        postAggregate = Post.aggregate([
            {
                $match: matchCondition
            },
            {
                $lookup: {
                    from: "users",
                    localField: "owner",
                    foreignField: "_id",
                    as: "owner",
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                fullName: 1,
                                avatar: "$avatar.url",
                                username: 1,
                            }
                        }
                    ]
                }
            },
            {
                $addFields: {
                    owner: {
                        $first: "$owner",
                    },
                },
            },
            // sorting according to sortType which is ascending in this case
            {
                $sort: {
                    [sortBy]: sortDirection
                }
            }
        ])
    } catch (error) {
        throw new ApiError(500, error.message || "Internal server error in post aggregation");
    }
    const options = {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        customLabels: {
            totalDocs: "totalPosts",
            docs: "posts",
        },
        skip: (parseInt(page, 10) - 1) * parseInt(limit, 10),
    };

    Post.aggregatePaginate(postAggregate, options)
        .then(result => {
            if (result?.posts?.length === 0 && userId) {
                return res.status(200).json(new ApiResponse(200, [], "No posts found"));
            }

            return res.status(200).json(new ApiResponse(200, result, "Post fetched successfully"));
        })
        .catch(error => {
            console.log("Error:", error);
            throw new ApiError(500, error?.message || "Internal server error in post aggregate paginate");
        });
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

const getPostbyId = asyncHandler(async (req, res) => {
    const { postId } = req.params;
    if (!isValidObjectId(postId)) throw new ApiError(400, "Post Id is not a valid id");
    const post = await Post.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(postId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            avatar: "$avatar.url",
                            fullName: 1,
                            _id: 1
                        }

                    }
                ]
            }
        },
        {
            $addFields: {
                owner: {
                    $first: "$owner"
                }
            }
        },
        {
            $addFields: {
                photo: "$photo.url",
            },
        },
    ])
    if (!post) throw new ApiError(500, "Post detail not found");
    return res.status(200)
        .json(
            new ApiResponse(
                200,
                post[0],
                "Post fetched successfully"
            )
        )
})

const updatePost = asyncHandler(async (req, res) => {
    const { postId } = req.params
    const { caption } = req.body;

    if (!isValidObjectId(postId)) throw new ApiError(400, "Not a valid post id")

    if (!caption) throw new ApiError(400, "Caption is required");

    const oldPost = await Post.findById(postId, { caption: 1 });
    if (!oldPost) throw new ApiError(404, "No Video Found");

    const post = await Post.findByIdAndUpdate(
        postId,
        {
            $set: {
                caption
            }

        },
        {
            new: true
        }
    )
    if (!post) {
        throw new ApiError(500, "updated post not uploaded on database");
    }
    return res.status(200)
        .json(new ApiResponse(
            201,
            post,
            "Post Updated Successfully"
        ))


})

const deletePost = asyncHandler(async (req, res) => {
    const { postId } = req.params;
    var deletePhotoPromise;
    try {
        // 1. Validate videoId and fetch video details (optimized query)
        const post = await Post.findById(postId, { photo: 1 })
            .select('_id photo'); // Use aggregation pipeline for efficiency

        if (!post) throw new ApiError(404, "No post Found");

        // 2. Delete video file and thumbnail from Cloudinary (concurrent calls)
        [deletePhotoPromise] = await Promise.all([
            deleteOnCloudinary(post.photo.url, post.photo.publicId),
        ]);

        // 3. Delete video from database
        await Post.findByIdAndDelete(postId);

        // 4. Remove video from related collections (optimized updates)
        // const updatePromises = [
        //     User.updateMany({ watchHistory: videoId }, { $pull: { watchHistory: videoId } }),
        //     Comment.deleteMany({ video: videoId }),
        //     Playlist.updateMany({ videos: videoId }, { $pull: { videos: videoId } }),
        // ];

        // await Promise.all(updatePromises);


        // 5. Handle any remaining tasks (e.g., removing likes)
        // ...

        return res.status(200).json(new ApiResponse(201, {}, "Post Deleted Successfully"));

    } catch (error) {
        console.error("Error while deleting post:", error);

        // Rollback Cloudinary actions if necessary
        try {
            if (deletePhotoPromise?.error) await deletePhotoPromise.retry(); // Attempt retry
        } catch (cloudinaryError) {
            console.error("Failed to rollback Cloudinary deletions:", cloudinaryError);
        }

        throw new ApiError(500, error.message || 'Server Error while deleting post');
    }
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { postId } = req.params
    if (!isValidObjectId(postId)) throw new ApiError(400, "Invalid post Id")


    const post = await Post.findById(postId, { _id: 1, isPublished: 1, owner: 1 });
    if (!post) throw new ApiError(404, "No post Found")

    if (post?.owner?.toString() !== req.user?._id?.toString()) throw new ApiError(401, "Unauthorized Request")


    const togglePost = await Post.findByIdAndUpdate(
        postId,
        {
            $set: {
                isPublished: !post?.isPublished
            }
        },
        {
            new: true
        }
    )

    if (!togglePost) throw new ApiError(500, "Something went wrong while updating post")
    return res.status(200)
        .json(new ApiResponse(
            201,
            togglePost,
            togglePost?.isPublished ? "Post Published Successfully" : "Post Unpublished Successfully"
        ))
})


export {
    getAllPosts,
    publishAPost,
    getPostbyId,
    updatePost,
    deletePost,
    togglePublishStatus
}
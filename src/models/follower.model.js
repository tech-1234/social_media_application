import mongoose, { Schema } from "mongoose";

const followerSchema = new Schema(
    {
        followerId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        followingId: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
)

export const Follower = mongoose.model("Follower", followerSchema)
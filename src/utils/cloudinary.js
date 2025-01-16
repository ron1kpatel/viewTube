import {v2 as cloudinary} from 'cloudinary'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config({ path: "./src/.env" });


//Configure cloudinary


cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET 
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) return null;

        //uploading file on cloudinary
        const uploadResult = await cloudinary.uploader.upload(localFilePath, {
            resource_type: 'auto'
        })

        console.log("File uploaded in cloudinary, File src: " + uploadResult.url)

        //once file is uploaded, delete it from local storage f server
        fs.unlinkSync(localFilePath)

        return uploadResult;
    } catch (error) {
        //  console.log(" cloud_name: ", process.env.CLOUDINARY_CLOUD_NAME, 
        //     "api_key:", process.env.CLOUDINARY_API_KEY, 
        //     "api_secret:", process.env.CLOUDINARY_API_SECRET )
        console.log("Error on Cloudinary ", error);
        fs.unlinkSync(localFilePath);
        return null
    }
}

const deleteFromCloudinary = async (publicId) => {
    try {
        const result = await cloudinary.uploader.destroy(publicId);
        console.log("Deleted from cloudinary. Public Id: ", publicId);
    } catch (error) {
        console.log("Error while deleting from cloudinary");
        throw new Error("Error while deleting from cloudinary", error);
        return null;
        
    }
}

export {uploadOnCloudinary, deleteFromCloudinary}
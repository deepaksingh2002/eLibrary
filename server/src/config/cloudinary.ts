import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const coverStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "book-covers",
    allowed_formats: ["jpg", "png", "webp"],
    resource_type: "image",
  } as any,
});

const pdfStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: "book-pdfs",
    allowed_formats: ["pdf"],
    resource_type: "raw",
  } as any,
});

export const uploadCover = multer({
  storage: coverStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
}).fields([{ name: "cover", maxCount: 1 }]);

export const uploadPDF = multer({
  storage: pdfStorage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
}).fields([{ name: "pdf", maxCount: 1 }]);

export const uploadBookFiles = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 2
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "cover" && !file.mimetype.startsWith("image/")) {
      return cb(new Error("Cover must be an image file"));
    }

    const looksLikePdf =
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf");

    if (file.fieldname === "pdf" && !looksLikePdf) {
      return cb(new Error("Book file must be a PDF"));
    }

    cb(null, true);
  }
}).fields([
  { name: "cover", maxCount: 1 },
  { name: "pdf", maxCount: 1 }
]);

export async function uploadBufferToCloudinary(
  buffer: Buffer,
  options: {
    folder: string;
    resource_type: "image" | "raw" | "auto";
    public_id?: string;
  }
): Promise<{ secure_url: string; public_id: string }> {
  return new Promise((resolve, reject) => {
    let uploadCompleted = false;
    
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder,
        resource_type: options.resource_type,
        public_id: options.public_id,
        timeout: 120000, // 2 minutes timeout for large files
        chunk_size: 6000000 // 6MB chunks for better streaming
      },
      (error, result) => {
        if (uploadCompleted) return; // Prevent double callback
        uploadCompleted = true;
        
        if (error) {
          return reject(new Error(`Cloudinary upload failed: ${error.message}`));
        }

        if (!result) {
            try {
              const signedUrl = cloudinary.url(publicId, {
                resource_type: "raw",
                sign_url: true,
                expires_at: Math.floor(Date.now() / 1000) + 600
              });
              if (signedUrl) {
                console.log("[Cloudinary] Successfully generated signed URL for:", publicId);
                return signedUrl;
              }
            } catch (err) {
              console.error("[Cloudinary] Signed URL generation failed, will try unsigned URL:", err instanceof Error ? err.message : err);
            }

            // Fallback: attempt unsigned URL (public delivery)
            try {
              const unsigned = cloudinary.url(publicId, { resource_type: "raw", sign_url: false });
              if (unsigned) {
                console.warn("[Cloudinary] Returning unsigned URL for:", publicId);
                return unsigned;
              }
            } catch (err) {
              console.error("[Cloudinary] Unsigned URL generation failed:", err instanceof Error ? err.message : err);
            }

            console.error("[Cloudinary] Generated empty URL for publicId:", publicId);
            return "";
      if (!uploadCompleted) {
        uploadCompleted = true;
        reject(new Error(`Stream error during upload: ${error.message}`));
      }
    });

    // Set a timeout for the overall operation
    const timeoutId = setTimeout(() => {
      if (!uploadCompleted) {
        uploadCompleted = true;
        uploadStream.destroy();
        reject(new Error("File upload timed out. File may be too large or connection is slow."));
      }
    }, 180000); // 3 minutes total timeout

    // Write buffer to stream
    uploadStream.end(buffer);
    
    // Clear timeout on completion
    uploadStream.on("finish", () => {
      clearTimeout(timeoutId);
    });
  });
}

export async function deleteFromCloudinary(
  publicId: string,
  resourceType: "image" | "raw" = "image"
): Promise<void> {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
  } catch (error) {
    console.error("[Cloudinary] Delete failed for:", publicId, error);
  }
}

export function generateSignedUrl(publicId: string): string {
  if (!publicId) {
    console.warn("[Cloudinary] generateSignedUrl called with empty publicId");
    return "";
  }

  try {
    // Validate Cloudinary configuration
    if (!cloudinary.config().cloud_name) {
      console.error("[Cloudinary] CLOUDINARY_CLOUD_NAME not configured");
      return "";
    }

    const url = cloudinary.url(publicId, {
      resource_type: "raw",
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + 600
    });
    
    if (!url) {
      console.error("[Cloudinary] Generated empty URL for publicId:", publicId);
      return "";
    }
    
    console.log("[Cloudinary] Successfully generated signed URL for:", publicId);
    return url;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Cloudinary] Failed to generate signed URL:", message);
    console.error("[Cloudinary] PublicId:", publicId);
    console.error("[Cloudinary] Config:", {
      cloud_name: cloudinary.config().cloud_name ? "set" : "NOT SET",
      api_key: cloudinary.config().api_key ? "set" : "NOT SET"
    });
    return "";
  }
}

export default cloudinary;

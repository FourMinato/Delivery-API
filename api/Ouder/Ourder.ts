import express, { Request, Response } from "express";
import { conn } from "../../dbconn";
import { OrderCreateRequest, OrderResponse } from '../Model/OurderGet';

import { getStorage, ref, getDownloadURL, uploadBytesResumable, deleteObject } from "firebase/storage";
import Config from '../config/firebase.config';
import multer from "multer";


export const router = express.Router();
const storage = getStorage();


const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // จำกัดขนาดไฟล์ที่ 5MB
    },
});

function giveCurrrentDateTime() {
    return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
}

// เพิ่มฟังก์ชันสำหรับลบรูปภาพจาก Firebase Storage
async function deleteImageFromFirebase(imageUrl: string) {
    try {
        // ดึงเฉพาะส่วนของ path จาก URL
        const urlObj = new URL(imageUrl);
        const imagePath = urlObj.pathname.split('/o/')[1];
        const decodedPath = decodeURIComponent(imagePath);

        const fileRef = ref(storage, decodedPath);
        await deleteObject(fileRef);
        console.log("Old image deleted successfully");
    } catch (error) {
        console.error("Error deleting old image:", error);
        // ถ้าต้องการให้โปรแกรมหยุดทำงานเมื่อลบไม่สำเร็จ ให้ throw error
        // throw error;
    }
}



router.post("/orders", upload.single('item_image'), async (req: Request, res: Response) => {
    try {
        const { sender_id, receiver_phone, item_name, item_description } = req.body;

        if (!sender_id || !receiver_phone || !item_name || !item_description) {
            return res.status(400).json({
                success: false,
                message: 'กรุณากรอกข้อมูลให้ครบถ้วน'
            });
        }

        // ตรวจสอบว่าเบอร์โทรศัพท์มีอยู่ในตาราง users หรือไม่
        const checkPhoneSql = "SELECT * FROM users WHERE phone = ?";
        conn.query(checkPhoneSql, [receiver_phone], async (checkErr: any, checkResult: any) => {
            if (checkErr) {
                console.error("Error checking phone number:", checkErr);
                return res.status(500).json({
                    success: false,
                    message: 'เกิดข้อผิดพลาดในการตรวจสอบเบอร์โทรศัพท์'
                });
            }

            if (checkResult.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'เบอร์โทรศัพท์ไม่ถูกต้องหรือไม่มีอยู่ในระบบ'
                });
            }

            let item_image_url = '';

            if (req.file) {
                const dateTime = giveCurrrentDateTime();
                const storageRef = ref(storage, `order_images/${req.file.originalname + "_" + dateTime}`);

                const metadata = {
                    contentType: req.file.mimetype,
                };

                try {
                    const snapshot = await uploadBytesResumable(storageRef, req.file.buffer, metadata);
                    item_image_url = await getDownloadURL(snapshot.ref);
                    console.log("Item image uploaded successfully. URL:", item_image_url);
                } catch (error) {
                    console.error("Error uploading item image:", error);
                    return res.status(500).json({ message: 'Error uploading item image' });
                }
            }

            const newOrder: OrderCreateRequest = {
                sender_id: parseInt(sender_id),
                receiver_phone,
                item_name,
                item_description,
                item_image: item_image_url,
                status_id: 1, // กำหนด status เป็น 1 โดยอัตโนมัติ
            };

            const sql = "INSERT INTO delivery_orders SET ?";

            conn.query(sql, newOrder, (err: any, result: any) => {
                if (err) {
                    console.error("Error during order insertion:", err);
                    return res.status(500).json({
                        success: false,
                        message: 'Error during order insertion'
                    });
                }

                const createdOrder: OrderResponse = {
                    ...newOrder,
                    order_id: result.insertId,
                    created_at: new Date(),
                    updated_at: new Date()
                };

                res.status(201).json({
                    success: true,
                    message: 'สร้างรายการสั่งซื้อสำเร็จ',
                    data: createdOrder
                });
            });
        });
    } catch (error) {
        console.error("Error in order creation process:", error);
        res.status(500).json({ message: 'Internal server error' });
    }
});


// API สำหรับอัปเดต order
router.put("/orders/:orderId", upload.single('item_image'), async (req: Request, res: Response) => {
    try {
        const orderId = req.params.orderId;
        const { sender_id, receiver_phone, item_name, item_description } = req.body;

        // ตรวจสอบข้อมูลที่จำเป็น
        if (!sender_id || !receiver_phone || !item_name || !item_description) {
            return res.status(400).json({
                success: false,
                message: 'กรุณากรอกข้อมูลให้ครบถ้วน'
            });
        }
        
        const checkPhoneSql = "SELECT * FROM users WHERE phone = ?";
        conn.query(checkPhoneSql, [receiver_phone], async (checkErr: any, checkResult: any) => {
            if (checkErr) {
                console.error("Error checking phone number:", checkErr);
                return res.status(500).json({
                    success: false,
                    message: 'เกิดข้อผิดพลาดในการตรวจสอบเบอร์โทรศัพท์'
                });
            }

            if (checkResult.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'เบอร์โทรศัพท์ไม่ถูกต้องหรือไม่มีอยู่ในระบบ'
                });
            }
        });

        

        // ดึงข้อมูล order เดิม
        const getOldOrderSql = "SELECT * FROM delivery_orders WHERE order_id = ?";
        conn.query(getOldOrderSql, [orderId], async (err: any, result: any) => {
            if (err) {
                console.error("Error fetching old order:", err);
                return res.status(500).json({
                    success: false,
                    message: 'Error fetching old order'
                });
            }

            if (result.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Order not found'
                });
            }

            const oldOrder = result[0];
            let item_image_url = oldOrder.item_image;

            // ถ้ามีการอัปโหลดรูปภาพใหม่
            if (req.file) {
                const dateTime = giveCurrrentDateTime();
                const storageRef = ref(storage, `order_images/${req.file.originalname + "_" + dateTime}`);

                const metadata = {
                    contentType: req.file.mimetype,
                };

                try {
                    // อัปโหลดรูปภาพใหม่
                    const snapshot = await uploadBytesResumable(storageRef, req.file.buffer, metadata);
                    const newImageUrl = await getDownloadURL(snapshot.ref);
                    console.log("New item image uploaded successfully. URL:", newImageUrl);

                    // ลบรูปภาพเก่า
                    if (oldOrder.item_image) {
                        try {
                            await deleteImageFromFirebase(oldOrder.item_image);
                            console.log("Old image deleted successfully");
                        } catch (deleteError) {
                            console.error("Error deleting old image:", deleteError);
                            // ไม่ต้อง return error response ที่นี่ เพราะเราไม่ต้องการให้การอัปเดตล้มเหลวเพียงเพราะลบรูปเก่าไม่ได้
                        }
                    }

                    // อัปเดต item_image_url เฉพาะเมื่อการอัปโหลดรูปใหม่สำเร็จ
                    item_image_url = newImageUrl;
                } catch (uploadError) {
                    console.error("Error uploading new image:", uploadError);
                    return res.status(500).json({ message: 'Error uploading new image' });
                }
            }

            // อัปเดตข้อมูลในฐานข้อมูล
            const updateOrderSql = "UPDATE delivery_orders SET sender_id = ?, receiver_phone = ?, item_name = ?, item_description = ?, item_image = ?, updated_at = ? WHERE order_id = ?";
            const updateValues = [
                parseInt(sender_id),
                receiver_phone,
                item_name,
                item_description,
                item_image_url,
                new Date(),
                orderId
            ];

            conn.query(updateOrderSql, updateValues, (updateErr: any, updateResult: any) => {
                if (updateErr) {
                    console.error("Error updating order:", updateErr);
                    return res.status(500).json({
                        success: false,
                        message: 'Error updating order'
                    });
                }

                res.status(200).json({
                    success: true,
                    message: 'อัปเดตรายการสั่งซื้อสำเร็จ',
                    data: {
                        order_id: orderId,
                        sender_id: parseInt(sender_id),
                        receiver_phone,
                        item_name,
                        item_description,
                        item_image: item_image_url,
                        updated_at: new Date()
                    }
                });
            });
        });
    } catch (error) {
        console.error("Error in order update process:", error);
        res.status(500).json({ message: 'Internal server error' });
    }
});
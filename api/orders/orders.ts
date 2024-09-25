import express from "express";
import { conn } from "../../dbconn";
import mysql from "mysql";


const multer = require('multer');
const upload = multer({ dest: 'uploads/' });


export const router = express.Router();


router.get("/", (req, res) => {
    const sql = `
        SELECT do.*, ds.status_name 
        FROM delivery_orders do
        JOIN delivery_status ds ON do.status_id = ds.status_id
    `;

    conn.query(sql, (err, result) => {
        if (err) {
            console.error(err);
            res.status(500).json({
                message: 'Internal Server Error'
            });
        } else {
            if (result.length > 0) {
                res.status(200).json({
                    success: true,
                    message: 'Get Data Success',
                    data: result
                });
            } else {
                res.status(400).json({
                    message: 'Get Data failed'
                });
            }
        }
    });
});


//สร้างรายการส่งสินค้า


router.post('/create-order/:user_id', upload.single('itemImage'), (req, res) => {
    const { user_id } = req.params;
    const { itemName, itemDescription, receiverPhone } = req.body;
    const itemImage = req.file ? req.file.path : null;

    if (!user_id || !itemName || !itemDescription || !receiverPhone) {
        return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    // ตรวจสอบว่าเลขโทรศัพท์ผู้รับมีอยู่ในตาราง users หรือไม่
    const checkPhoneSql = "SELECT * FROM users WHERE phone = ?";
    conn.query(checkPhoneSql, [receiverPhone], (checkErr, checkResult) => {
        if (checkErr) {
            console.error('Error checking receiver phone:', checkErr);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบเลขโทรศัพท์ผู้รับ' });
        }

        if (checkResult.length === 0) {
            return res.status(400).json({ message: 'ไม่พบเลขโทรศัพท์ผู้รับในระบบ' });
        }

        // ถ้าพบเลขโทรศัพท์ในระบบ ดำเนินการสร้างรายการส่งสินค้า
        const insertSql = `
            INSERT INTO delivery_orders 
            (sender_id, receiver_phone, item_name, item_description, item_image, status_id) 
            VALUES (?, ?, ?, ?, ?, 1)
        `;

        conn.query(insertSql, [user_id, receiverPhone, itemName, itemDescription, itemImage], (insertErr, insertResult) => {
            if (insertErr) {
                console.error('Error creating delivery order:', insertErr);
                return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้างรายการส่งสินค้า' });
            }

            res.status(201).json({ 
                message: 'สร้างรายการส่งสินค้าสำเร็จ',
                orderId: insertResult.insertId
            });
        });
    });
});


router.put("/update-order/:order_id", (req, res) => {
    const orderId = req.params.order_id;
    const { itemName, itemDescription, receiverPhone, itemImage } = req.body as {
        itemName?: string; itemDescription?: string; receiverPhone?: string; itemImage?: string;
    };

    // สร้างอ็อบเจ็กต์สำหรับเก็บข้อมูลที่จะอัพเดต
    const updateData: {[key: string]: string} = {};
    if (itemName !== undefined) updateData.item_name = itemName;
    if (itemDescription !== undefined) updateData.item_description = itemDescription;
    if (receiverPhone !== undefined) updateData.receiver_phone = receiverPhone;
    if (itemImage !== undefined) updateData.item_image = itemImage;

    // ตรวจสอบว่ามีข้อมูลที่จะอัพเดตหรือไม่
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'ไม่มีข้อมูลที่ต้องการอัพเดต' });
    }

    // สร้างคำสั่ง SQL สำหรับการอัพเดต
    const sql = "UPDATE delivery_orders SET ? WHERE order_id = ?";

    // ทำการ query พร้อมกับ error logging ที่ละเอียดขึ้น
    conn.query(sql, [updateData, orderId], (err, result) => {
        if (err) {
            console.error("Error updating delivery order:", err.message, err.stack);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์', error: err.message });
        }

        if (result.affectedRows > 0) {
            res.status(200).json({ message: 'อัพเดตรายการส่งสินค้าสำเร็จ' });
        } else {
            res.status(404).json({ message: 'ไม่พบรายการส่งสินค้าที่ระบุ' });
        }
    });
});

router.post('/accept-order/:order_id', (req, res) => {
    const { order_id } = req.params;
    const { rider_id } = req.body;

    if (!order_id || !rider_id) {
        return res.status(400).json({ message: 'กรุณาระบุ order_id และ rider_id' });
    }

    // ตรวจสอบสถานะของออเดอร์
    const checkOrderSql = "SELECT status_id FROM delivery_orders WHERE order_id = ?";
    conn.query(checkOrderSql, [order_id], (checkErr, checkResult) => {
        if (checkErr) {
            console.error('Error checking order status:', checkErr);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการตรวจสอบสถานะออเดอร์' });
        }

        if (checkResult.length === 0) {
            return res.status(404).json({ message: 'ไม่พบออเดอร์ที่ระบุ' });
        }

        if (checkResult[0].status_id !== 1) { // สมมติว่า 1 คือ 'รอเข้ารับ'
            return res.status(400).json({ message: 'ออเดอร์นี้ไม่สามารถรับได้' });
        }

        // อัพเดตสถานะออเดอร์
        const updateOrderSql = "UPDATE delivery_orders SET status_id = 2 WHERE order_id = ?";
        conn.query(updateOrderSql, [order_id], (updateErr, updateResult) => {
            if (updateErr) {
                console.error('Error updating order status:', updateErr);
                return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการอัพเดตสถานะออเดอร์' });
            }

            // เพิ่มบันทึกในตาราง delivery_status_tracking
            const insertTrackingSql = "INSERT INTO delivery_status_tracking (order_id, rider_id, status_id, timestamp) VALUES (?, ?, 2, CURRENT_TIMESTAMP)";
            conn.query(insertTrackingSql, [order_id, rider_id], (insertErr, insertResult) => {
                if (insertErr) {
                    console.error('Error inserting tracking record:', insertErr);
                    return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการบันทึกการติดตามสถานะ' });
                }

                res.status(200).json({ 
                    message: 'รับออเดอร์สำเร็จ',
                    orderId: order_id,
                    riderId: rider_id
                });
            });
        });
    });
});
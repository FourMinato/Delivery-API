import express from "express";
import { conn } from "../../dbconn";
import mysql from "mysql";


const multer = require('multer');
const upload = multer({ dest: 'uploads/' });


export const router = express.Router();


//สร้างรายการส่งสินค้า


router.post('/create-order', upload.single('itemImage'), (req, res) => {
    const { itemName, itemDescription, receiverPhone, senderId } = req.body;
    const itemImage = req.file ? req.file.path : null;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!itemName || !itemDescription || !receiverPhone || !senderId) {
        return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    const sql = `INSERT INTO delivery_orders 
                 (sender_id, receiver_phone, item_name, item_description, item_image, status) 
                 VALUES (?, ?, ?, ?, ?, 'รอจัดส่ง')`;

    conn.query(sql, [senderId, receiverPhone, itemName, itemDescription, itemImage], (err, result) => {
        if (err) {
            console.error('Error creating delivery order:', err);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดในการสร้างรายการส่งสินค้า' });
        }

        res.status(201).json({ 
            message: 'สร้างรายการส่งสินค้าสำเร็จ',
            orderId: result.insertId
        });
    });
});
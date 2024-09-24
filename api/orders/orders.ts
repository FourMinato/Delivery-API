import express from "express";
import { conn } from "../../dbconn";
import mysql from "mysql";


const multer = require('multer');
const upload = multer({ dest: 'uploads/' });


export const router = express.Router();


//สร้างรายการส่งสินค้า


router.post('/create-order/:user_id', upload.single('itemImage'), (req, res) => {
    const { user_id } = req.params;
    const { itemName, itemDescription, receiverPhone } = req.body;
    const itemImage = req.file ? req.file.path : null;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!user_id || !itemName || !itemDescription || !receiverPhone) {
        return res.status(400).json({ message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });
    }

    const sql = `INSERT INTO delivery_orders 
                 (sender_id, receiver_phone, item_name, item_description, item_image, status) 
                 VALUES (?, ?, ?, ?, ?, 'รอจัดส่ง')`;

    conn.query(sql, [user_id, receiverPhone, itemName, itemDescription, itemImage], (err, result) => {
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


router.put("/update-order/:id", (req, res) => {
    const orderId = req.params.id;
    const { itemName, itemDescription, receiverPhone, status } = req.body as {
        itemName?: string; itemDescription?: string; receiverPhone?: string; status?: string;
    };

    // สร้างอ็อบเจ็กต์สำหรับเก็บข้อมูลที่จะอัพเดต
    const updateData: {[key: string]: string} = {};
    if (itemName !== undefined) updateData.item_name = itemName;
    if (itemDescription !== undefined) updateData.item_description = itemDescription;
    if (receiverPhone !== undefined) updateData.receiver_phone = receiverPhone;
    if (status !== undefined) updateData.status = status;

    // ตรวจสอบว่ามีข้อมูลที่จะอัพเดตหรือไม่
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ message: 'ไม่มีข้อมูลที่ต้องการอัพเดต' });
    }

    // สร้างคำสั่ง SQL สำหรับการอัพเดต
    const sql = "UPDATE delivery_orders SET ? WHERE id = ?";

    // ทำการ query
    conn.query(sql, [updateData, orderId], (err, result) => {
        if (err) {
            console.error("Error updating delivery order:", err.message);
            return res.status(500).json({ message: 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์' });
        }

        if (result.affectedRows > 0) {
            res.status(200).json({ message: 'อัพเดตรายการส่งสินค้าสำเร็จ' });
        } else {
            res.status(404).json({ message: 'ไม่พบรายการส่งสินค้าที่ระบุ' });
        }
    });
});
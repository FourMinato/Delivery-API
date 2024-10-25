export interface OrderItem {
    item_id?: number;
    item_name: string;
    item_description?: string;
    item_quantity: number;
    item_price: number;
    item_image?: string | null;
    sender_id?: number,
}

export interface OrderCreateRequest {
    sender_id: number;
    receiver_phone: string;
    status_id: number;
    items: OrderItem[];
}

export interface OrderResponse extends Omit<OrderCreateRequest, 'items'> {
    order_id: number;
    total_amount: number;
    total_items: number;
    item_image: string | null;
    items: OrderItem[];
    created_at: Date;
    updated_at: Date;
}

export interface OrderDetail {
    order_id: number;
    item_name: string;
    item_description: string;
    item_image: string;
    status_name: string;
    created_at: Date;
    updated_at: Date;
    rider_name?: string;
    rider_phone?: string;
    other_party_name: string;  // ชื่อของผู้ส่ง/ผู้รับ
    other_party_phone: string; // เบอร์โทรของผู้ส่ง/ผู้รับ
}

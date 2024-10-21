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
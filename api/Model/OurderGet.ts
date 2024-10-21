export interface Order {
    order_id: number;
    sender_id: number;
    receiver_phone: string;
    item_name: string;
    item_description: string;
    item_image: string;
    status_id: number;
    created_at: Date;
    updated_at: Date;
}

export interface OrderCreateRequest {
    sender_id: number;
    receiver_phone: string;
    item_name: string;
    item_description: string;
    item_image: string;
    status_id: number;
}

export interface OrderResponse extends Order {}
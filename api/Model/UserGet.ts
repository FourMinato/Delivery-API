export interface UserGetResponse {
    user_id: number;
    username: string;
    phone: string;
    password: string;
    address: string | null;
    car_license: string | null;
    type: number;  // 1 = ผู้ใช้ทั่วไป, 2 = ไรเดอร์
    gps_location: string | null;
    profile_image: string | null;
}
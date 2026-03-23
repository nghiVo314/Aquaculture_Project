import serial.tools.list_ports
import requests
import random
import time
import datetime
import sys
from Adafruit_IO import MQTTClient


schedules = []

config = {
    "DO": {"min": 5.0, "max": 7.0},   # Oxy < 5 -> Bật sục khí, > 7 -> Tắt sục khí
    "PH": {"min": 5.0, "max": 8.0},   # pH ngoài khoảng 5-8 -> Bật bơm, trong khoảng -> Tắt
    "TEMP": {"high": 40.0, "low": 30.0}, # Nhiệt độ > 40 -> Bật quạt, < 30 -> Tắt quạt
    "MODE": "AUTO" # Chế độ: AUTO hoặc MANUAL
}

# Trạng thái thiết bị hiện tại
device_status = {
    "AERATOR": "OFF", # Máy sục khí
    "PUMP": "OFF",    # Máy bơm
    "FAN": "OFF",     # Quạt
    "FEEDER": "OFF"   # Máy cho ăn
}

# Cập nhật ID sang String vì schema2 dùng VARCHAR(50) cho ma_cam_bien
sensor_id_map = {
    "TEMP": "CB_TEMP_01",
    "DO": "CB_DO_01"
}

# Thêm hàm đồng bộ lịch trình từ server
def sync_schedules_from_server(tbtaibien_id="DK_FEEDER_01"): # Sử dụng string ID
    global schedules
    try:
        # Đường dẫn route đã được chuẩn hóa trong routes/devices.js
        response = requests.get(f"http://127.0.0.1:5000/api/devices/gateway/{tbtaibien_id}", timeout=3)
        if response.status_code == 200:
            schedules = response.json().get("schedules", [])
            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Đã đồng bộ Lịch trình thành công!")
    except Exception as e:
        print(f"Lỗi đồng bộ lịch trình: {e}")

# config threshold
def sync_config_from_server(ao_id="AO_01"): # Sử dụng string ID
    global config
    try:
        # Gọi API lấy cấu hình từ Backend
        response = requests.get(f"http://127.0.0.1:5000/api/ponds/{ao_id}/config", timeout=3)
        if response.status_code == 200:
            server_configs = response.json().get("configs", [])
            
            # Cập nhật lại biến config của Gateway từ dữ liệu Database
            for item in server_configs:
                loai = item["LoaiCamBien"] # VD: "TEMP", "DO", "PH"
                if loai == "TEMP":
                    config["TEMP"]["low"] = item["min_value"]
                    config["TEMP"]["high"] = item["max_value"]
                elif loai in ["DO", "PH"]:
                    config[loai]["min"] = item["min_value"]
                    config[loai]["max"] = item["max_value"]
            
            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Đã đồng bộ cấu hình từ Server thành công!")
    except Exception as e:
        print(f"Lỗi đồng bộ cấu hình (Server có thể đang tắt): {e}")

def control_device(device_name, action):
    global device_status
    if device_status[device_name] != action:
        device_status[device_name] = action
        print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] LỆNH ĐIỀU KHIỂN: {device_name} -> {action}")
        # Tại đây bạn có thể dùng client.publish("bbc-" + device_name.lower(), action) để gửi lên Adafruit

def processData(sensor_type, value):
    global config
    print(f"Cảm biến {sensor_type} đo được: {value}")
    
    # Chỉ tự động chạy nếu đang ở chế độ AUTO
    if config["MODE"] == "AUTO":
        if sensor_type == "DO":
            if value < config["DO"]["min"]:
                control_device("AERATOR", "ON")
            elif value > config["DO"]["max"]:
                control_device("AERATOR", "OFF")
                
        elif sensor_type == "PH":
            if value < config["PH"]["min"] or value > config["PH"]["max"]:
                control_device("PUMP", "ON")
            else:
                control_device("PUMP", "OFF")
                
        elif sensor_type == "TEMP":
            if value > config["TEMP"]["high"]:
                control_device("FAN", "ON")
            elif value <= config["TEMP"]["low"]:
                control_device("FAN", "OFF")

    # Gửi dữ liệu về backend
    try:
        # Schema2: Bỏ tự sinh "id", Database xử lý AUTO_INCREMENT
        res = requests.post("http://127.0.0.1:5000/api/sensors", json={
            "device_id": sensor_id_map.get(sensor_type, "CB_UNKNOWN"), 
            "value": value
        })
        
        if res.status_code == 200:
            print(f"  -> Đã gửi {sensor_type} lên Server. Kết quả: 200 (OK)")
        else:
            print(f"  -> SERVER BÁO LỖI: {res.status_code} - Chi tiết: {res.text}")
            
    except Exception as e:
        print(f"  -> LỖI GỬI API SENSOR: {e}")

def check_feeder_schedule():
    global schedules
    # Chỉ lấy phần Time (Giờ:Phút:Giây)
    now_time = datetime.datetime.now().time() 
    
    should_run = False
    for sched in schedules:
        try:
            # MySQL TIME format is "HH:MM:SS"
            start = datetime.datetime.strptime(sched["start_time"], "%H:%M:%S").time()
            end = datetime.datetime.strptime(sched["end_time"], "%H:%M:%S").time()
            
            # Kiểm tra giờ hiện tại có nằm trong khoảng lịch trình không
            if start <= now_time <= end:
                should_run = True
                break
        except ValueError:
            print(f"  -> Lỗi parsing thời gian lịch trình: {sched}")
            
    if should_run:
        control_device("FEEDER", "ON")
    else:
        control_device("FEEDER", "OFF")


def fakeSerial():
    # Tạo dữ liệu giả ngẫu nhiên xung quanh các ngưỡng để test logic
    fake_do = round(random.uniform(3.0, 9.0), 1)     # Oxy từ 3.0 đến 9.0
    fake_temp = round(random.uniform(25.0, 45.0), 1) # Nhiệt độ từ 25.0 đến 45.0
    
    processData("DO", fake_do)
    processData("TEMP", fake_temp)
    check_feeder_schedule()
    print("-" * 30)

# Vòng lặp chính của Gateway
sync_counter = 0
while True:
    # Cứ mỗi 3 lần gửi dữ liệu (khoảng 15 giây), Gateway sẽ đồng bộ cấu hình 1 lần
    if sync_counter % 3 == 0:
        sync_config_from_server(ao_id="AO_01")
        sync_schedules_from_server(tbtaibien_id="DK_FEEDER_01")
    sync_counter += 1

    fakeSerial() # Chạy logic thu thập dữ liệu và điều khiển như cũ
    time.sleep(5)
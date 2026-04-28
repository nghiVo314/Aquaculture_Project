import serial.tools.list_ports
import requests
import random
import time
import datetime
import sys
from adafruit_service import (
    init_adafruit,
    publish_sensor_pond1,
    publish_device_pond1
)


# ==========================================
# HÀM ĐỂ INITIALIZE LỨC BẮT ĐẦU CHẠY
# ==========================================
# Biến toàn cục lưu trữ dữ liệu và cấu hình cho từng ao
ponds_data = {}
#láy config của các ao từ database
def init_ponds_data_from_server():
    global ponds_data
    try:
        print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Đang tải dữ liệu cấu trúc hệ thống từ Server...")
        # Gọi API mới mà bạn sẽ viết bên Node.js (tên API do bạn tự định nghĩa)
        response = requests.get("http://localhost:5000/api/ponds/gateway-init", timeout=5)
        
        if response.status_code == 200:
            server_ponds = response.json()

            #reset lại ponds_data trước khi nạp mới
            ponds_data = {}
            
            for pond in server_ponds:
                gateway_id = str(pond.get("gateway_id")) # VD: "1" hoặc "2"
                
                # Nạp dữ liệu động vào ponds_data (dữ liệu mặt đính -> sẽ được đồng bộ và thay đổi sau)
                ponds_data[gateway_id] = {
                    "ao_id": pond["ao_id"],
                    "feeder_id": pond["feeder_id"],
                    "config": {
                        "TEMP": {"high": 28, "low": 25},
                        "LIGHT": {"high": 40, "low": 9},
                        "MODE": "AUTO"
                    },
                    "device_status": {
                        "PUMP": "OFF",
                        "FAN": "OFF",
                        "FEEDER": "OFF"
                    },
                    "sensor_ids": pond["sensor_ids"], # Lấy dict sensor ids từ server
                    "schedules": [],
                    "is_feeding_logged": False # <--- THÊM DÒNG NÀY ĐỂ TRACKING
                }
            print("✅ Đã khởi tạo cấu trúc ao thành công từ Database!")
            
            # Sau khi có cấu trúc, lập tức đồng bộ config và lịch trình
            for pond_key in ponds_data.keys():
                sync_config_from_server(pond_key)
                sync_schedules_from_server(pond_key)
                
        else:
            print(f"❌ Lỗi tải dữ liệu ao: Server trả về mã {response.status_code}")
    except Exception as e:
        print(f"❌ Không thể kết nối tới Server để khởi tạo dữ liệu: {e}")
        sys.exit() # Nếu không load được dữ liệu gốc thì nên dừng chương trình

# ==========================================
# CÁC HÀM GIAO TIẾP SERVER & ĐIỀU KHIỂN
# ==========================================

def sync_schedules_from_server(pond_key):
    try:
        feeder_id = ponds_data[pond_key]["feeder_id"]
        response = requests.get(f"http://localhost:5000/api/devices/gateway/{feeder_id}", timeout=3)
        if response.status_code == 200:
            ponds_data[pond_key]["schedules"] = response.json().get("schedules", [])
            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Đã đồng bộ Lịch trình ao {pond_key} thành công!")
    except Exception as e:
        print(f"Lỗi đồng bộ lịch trình ao {pond_key}: {e}")

def get_active_schedule(pond_key):
    now_time = datetime.datetime.now().time()

    for sched in ponds_data[pond_key].get("schedules", []):
        try:
            start = datetime.datetime.strptime(sched["start_time"], "%H:%M:%S").time()
            end = datetime.datetime.strptime(sched["end_time"], "%H:%M:%S").time()

            if start <= now_time <= end:
                return sched
        except Exception:
            continue

    return None

def sync_config_from_server(pond_key):
    try:
        ao_id = ponds_data[pond_key]["ao_id"]
        response = requests.get(f"http://localhost:5000/api/ponds/{ao_id}/config", timeout=3)
        if response.status_code == 200:
            
            data = response.json()
            # 1. Update the Pond Mode from the database payload
            # (Assuming your backend API sends { che_do: 'AUTO', configs: [...] })
            db_mode = data.get("che_do", "AUTO") 
            ponds_data[pond_key]["config"]["MODE"] = db_mode

            server_configs = response.json().get("configs", [])            
            # Cập nhật lại biến config của từng ao
            for item in server_configs:
                loai = item["LoaiCamBien"]
                if loai == "TEMP":
                    ponds_data[pond_key]["config"]["TEMP"]["low"] = item["min_value"]
                    ponds_data[pond_key]["config"]["TEMP"]["high"] = item["max_value"]
                elif loai == "LIGHT":
                    ponds_data[pond_key]["config"]["LIGHT"]["low"] = item["min_value"]
                    ponds_data[pond_key]["config"]["LIGHT"]["high"] = item["max_value"]
            
            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Đã đồng bộ cấu hình ao {pond_key} từ Server!")
    except Exception as e:
        print(f"Lỗi đồng bộ cấu hình ao {pond_key}: {e}")


#hàm đồng bộ trạng thái thiết bị từ server, để đảm bảo khi có lệnh thủ công từ app thì gateway cũng nhận được và cập nhật lại trạng thái thiết bị cho đúng
def sync_device_status_from_server(pond_key):
    try:
        ao_id = ponds_data[pond_key]["ao_id"]
        response = requests.get(f"http://localhost:5000/api/devices/gateway/status/{ao_id}", timeout=3)
        if response.status_code == 200:
            server_devices = response.json().get("devices", [])
            
            for dev in server_devices:
                # Map DB status (HOAT_DONG/TAT) to Gateway action (ON/OFF)
                action = "ON" if dev["trang_thai"] == "HOAT_DONG" else "OFF"
                device_name = dev["loai_thiet_bi"] # e.g., AERATOR, PUMP
                
                # If server status is different from current status, execute command
                if ponds_data[pond_key]["device_status"].get(device_name) != action:
                    print(f"🔄 Đã nhận lệnh thủ công từ Server: {device_name} -> {action}")
                    control_device(pond_key, device_name, action)

                #adafruit
                if str(pond_key) == "TRAM_AO_01":
                    publish_device_pond1(device_name, action)

    except Exception as e:
        print(f"Lỗi đồng bộ trạng thái thiết bị ao {pond_key}: {e}")

# Hàm điều khiển thiết bị, gửi lệnh xuống mạch khi vượt ngưỡng
def control_device(pond_key, device_name, action):
    global isMicrobitConnected

    if ponds_data[pond_key]["device_status"][device_name] != action:
        ponds_data[pond_key]["device_status"][device_name] = action

        print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] LỆNH ĐIỀU KHIỂN AO {pond_key}: {device_name} -> {action}")

        device_name_clean = device_name.strip().upper()
        pond_number = "_".join(pond_key.split("_")[1:])

        device_id = f"DK_{device_name_clean}_{pond_number}"

        db_status = "HOAT_DONG" if action == "ON" else "TAT"

        #UPDATE DEVICE STATUS chắc cần auth nhưng thôi kệ không ảnh hưởng gì => bỏ auth bên backend?
        try:
            res = requests.put(
                f"http://localhost:5000/api/devices/{device_id}/status",
                json={"trang_thai": db_status},
                timeout=3
            )
            #print("PUT status:", res.status_code)
        except Exception as e:
            print("❌ Lỗi update status:", e)

        #FEEDING LOGIC để ghi vào lịch sử cho ăn
        if device_name_clean == "FEEDER":
            if action == "ON" and not ponds_data[pond_key]["is_feeding_logged"]:
                ponds_data[pond_key]["is_feeding_logged"] = True

                active_schedule = get_active_schedule(pond_key)
                ma_cong_thuc = active_schedule.get("ma_cong_thuc") if active_schedule else None

                try:
                    res = requests.post(
                        "http://localhost:5000/api/devices/feeding-history",
                        json={
                            "ma_cong_thuc": ma_cong_thuc,
                            "ma_tb_dieu_khien": device_id,
                            "muc_do_them_an": None,
                            "bang_chung_hinh_anh": None
                        },
                        timeout=3
                    )

                    print("POST status:", res.status_code)
                    print("POST response:", res.text)

                except Exception as e:
                    print("❌ Lỗi gọi API:", e)

            elif action == "OFF":
                ponds_data[pond_key]["is_feeding_logged"] = False
        # -------------------------------------------

        if str(pond_key) == "1":
            publish_device_pond1(device_name, action)

        if isMicrobitConnected:
            try:
                # Gửi lệnh kèm ID ao. VD: "!1:FAN:ON#" hoặc "!2:PUMP:OFF#"
                command = f"!{pond_key}:{device_name}:{action}#\n"
                ser.write(command.encode("UTF-8"))
            except Exception as e:
                print(f"❌ Lỗi gửi lệnh xuống mạch ao {pond_key}: {e}")

# Logic điều khiển bật tắt thiết bị dựa trên ngưỡng cảm biến và chế độ AUTO/MANUAL
def processData(pond_key, sensor_type, value):
    if pond_key not in ponds_data:
        print(f"⚠️ Không tìm thấy cấu hình cho Ao ID: {pond_key}")
        return
    #publish to adafruit
    if(str(sensor_type).upper() == "TEMP" and str(pond_key) == "TRAM_AO_01"):
        publish_sensor_pond1(sensor_type, value)
    elif(str(sensor_type).upper() == "LIGHT" and str(pond_key) == "TRAM_AO_01"):
        publish_sensor_pond1(sensor_type, value)

    # Lấy cấu hình và sensor_ids tương ứng với ao hiện tại
    config = ponds_data[pond_key]["config"]
    sensor_ids = ponds_data[pond_key]["sensor_ids"]

    #Debug: In thông tin cảm biến nhận được
    print(f"Ao {pond_key} - Cảm biến {sensor_type} đo được: {value}")
    
    # Chỉ tự động chạy nếu đang ở chế độ AUTO
    if config["MODE"] == "AUTO":
        # if sensor_type == "DO":
        #     if value < config["DO"]["min"]:
        #         control_device(pond_key, "AERATOR", "ON")
        #     elif value > config["DO"]["max"]:
        #         control_device(pond_key, "AERATOR", "OFF")
            
                
        if sensor_type == "TEMP":
            if value > config["TEMP"]["high"]:
                control_device(pond_key, "FAN", "ON")
            elif value <= config["TEMP"]["low"]:
                control_device(pond_key, "FAN", "OFF")

        elif sensor_type == "LIGHT":
            if value > config["LIGHT"]["high"]:
                control_device(pond_key, "PUMP", "ON")
            elif value <= config["LIGHT"]["low"]:
                control_device(pond_key, "PUMP", "OFF")

    # Gửi dữ liệu về backend    
    try:
        device_id = sensor_ids.get(sensor_type, "CB_UNKNOWN")
        res = requests.post("http://localhost:5000/api/sensors", json={
            "device_id": device_id, 
            "value": value
        })
        
        if res.status_code == 200:
            print(f"  -> Đã gửi {sensor_type} (Ao {pond_key}) lên Server. OK")
        else:
            print(f"  -> SERVER BÁO LỖI: {res.status_code} - Chi tiết: {res.text}")
    except Exception as e:
        print(f"  -> LỖI GỬI API SENSOR: {e}")

    if str(pond_key) == "1":
        publish_sensor_pond1(sensor_type, value)


def check_feeder_schedule():
    now_time = datetime.datetime.now().time() 
    
    # Kiểm tra lịch cho cả 2 ao
    for pond_key, data in ponds_data.items():
        schedules = data["schedules"]
        should_run = False
        
        for sched in schedules:
            try:
                start = datetime.datetime.strptime(sched["start_time"], "%H:%M:%S").time()
                end = datetime.datetime.strptime(sched["end_time"], "%H:%M:%S").time()
                
                if start <= now_time <= end:
                    should_run = True
                    break
            except ValueError:
                print(f"  -> Lỗi parsing thời gian lịch trình ao {pond_key}: {sched}")
                
        if should_run:
            control_device(pond_key, "FEEDER", "ON")
        else:
            control_device(pond_key, "FEEDER", "OFF")
        

#kiểm tra kết nối với microbit, nếu kết nối được thì đọc dữ liệu thực tế, nếu không thì fake dữ liệu để test
isMicrobitConnected = False
try:
    ser = serial.Serial(port="COM6", baudrate=115200, timeout=1)
    isMicrobitConnected = True
    print("✅ Đã kết nối thành công với mạch trên cổng COM")
except Exception as e:
    print(f"❌ Lỗi kết nối cổng Serial COM: {e}")
    isMicrobitConnected = False

# Khởi tạo kết nối với Adafruit IO
init_adafruit()


mess = "" 
# Hàm phân tích dữ liệu Serial nhận được từ mạch
def parseSerialData(data_string):
    try:
        clean_data = data_string.replace("!", "").replace("#", "")
        splitData = clean_data.split(":")

        if len(splitData) >= 3:
            pond_key = splitData[0]
            item_type = splitData[1]
            raw_value = splitData[2]

            # Nếu là cảm biến số
            if item_type in ["TEMP", 'LIGHT']:
                value = float(raw_value)
                print(f"Nhận dữ liệu cảm biến: Ao {pond_key} - {item_type} = {value}")
                processData(pond_key, item_type, value)

            # Nếu là trạng thái thiết bị
            elif item_type in ["FAN", "PUMP", "FEEDER", "AERATOR"]:
                print(f"Thiết bị phản hồi: Ao {pond_key} - {item_type} = {raw_value}")

    except Exception as e:
        print(f"Lỗi Serial: {data_string} -> {e}")

#đọc dữ liệu từ cổng serial, tìm kiếm chuỗi dữ liệu hoàn chỉnh nằm giữa '!' và '#', sau đó gọi hàm parseSerialData để xử lý
def readSerial():
    global mess
    if not isMicrobitConnected:
        return

    try:
        bytesToRead = ser.inWaiting()
        if bytesToRead > 0:
            mess = mess + ser.read(bytesToRead).decode("UTF-8")
            while ("#" in mess) and ("!" in mess):
                start = mess.find("!")
                end = mess.find("#")
                
                if start < end:
                    data = mess[start:end + 1]
                    parseSerialData(data) 
                    
                if end == len(mess) - 1:
                    mess = ""
                else:
                    mess = mess[end+1:]
    except Exception as e:
        pass


latest_real_temp= 27.0
latest_real_light = 20.0
real_temp_pond_id = None
# Hàm tạo dữ liệu giả cho DO, PH và TEMP (chỉ fake TEMP cho ao không có cảm biến thật)
def fakeSerial():
    global latest_real_temp, latest_real_light, real_temp_pond_id
    
    # Tạo dữ liệu giả định kỳ cho các ao
    for pond_key in ponds_data.keys():
        
        # # 1. Luôn fake DO và PH cho tất cả các ao
        # fake_do = round(random.uniform(4.5, 7.5), 1)     
        # fake_ph = round(random.uniform(6.0, 8.5), 1) 
        # processData(pond_key, "DO", fake_do)
        # processData(pond_key, "PH", fake_ph)

        # 2. Fake TEMP cho các ao KHÔNG có cảm biến thật
        if pond_key != real_temp_pond_id:
            # Tạo nhiệt độ ảo chênh lệch một chút (+- 0.5 độ) so với ao có cảm biến thật
            fake_temp = round(latest_real_temp + random.uniform(-5, 2), 1)
            processData(pond_key, "TEMP", fake_temp)
            fake_light = round(latest_real_light + random.uniform(-20, 30), 1)
            processData(pond_key, "LIGHT", fake_light)

# Hàm kiểm tra tín hiệu reload từ server để cập nhật lại cấu trúc ao nếu có thay đổi
def check_reload_signal():
    global ponds_data
    try:
        # Gọi API check-reload với timeout rất ngắn để không treo vòng lặp
        response = requests.get("http://localhost:5000/api/ponds/check-reload", timeout=1)
        if response.status_code == 200:
            data = response.json()
            if data.get("reload") == True:
                print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Phát hiện thay đổi cấu trúc ao! Đang cập nhật...")
                
                # Gọi lại hàm khởi tạo để cập nhật ponds_data
                init_ponds_data_from_server()
                
    except Exception as e:
        # Không in lỗi quá nhiều nếu server chỉ mất kết nối tạm thời
        pass


# ==========================================
# VÒNG LẶP CHÍNH
# ==========================================
#gọi để lấy dữ liệu cấu trúc ao từ db duy nhất 1 lần
init_ponds_data_from_server()

sync_counter = 0

while True:
    # 1. Định kỳ đồng bộ cấu hình cho tất cả các ao
    for pond_key in list(ponds_data.keys()):
        sync_config_from_server(pond_key)
        sync_schedules_from_server(pond_key)
        sync_device_status_from_server(pond_key)
    # if sync_counter % 3 == 0: 
    #     for pond_key in list(ponds_data.keys()):
    #         #cập nhật thay đổi cấu hình và lịch trình từ server, đồng thời cập nhật trạng thái thiết bị để đồng bộ với lệnh thủ công từ app
    #         sync_config_from_server(pond_key)
    #         sync_schedules_from_server(pond_key)
    #         sync_device_status_from_server(pond_key)
    # sync_counter += 1

    # 2. Đọc dữ liệu thực tế từ mạch và tạo dữ liệu giả
    if isMicrobitConnected:
        readSerial()
    else:
        fakeSerial() 

    # 3. Kiểm tra lịch cho ăn
    check_feeder_schedule()

    # 4. Kiểm tra tín hiệu reload khi có thay đổi (vd: thêm/sửa/xóa ao, thiết bị, cảm biến...)
    check_reload_signal()
    
    time.sleep(30)












# import serial.tools.list_ports
# import requests
# import random
# import time
# import datetime
# import sys
# from adafruit_service import (
#     init_adafruit,
#     sync_adafruit_structure,
#     publish_sensor_data,
#     publish_device_data
# )


# # ==========================================
# # HÀM ĐỂ INITIALIZE LỨC BẮT ĐẦU CHẠY
# # ==========================================
# # Biến toàn cục lưu trữ dữ liệu và cấu hình cho từng ao
# ponds_data = {}
# #láy config của các ao từ database
# def init_ponds_data_from_server():
#     global ponds_data
#     try:
#         print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Đang tải dữ liệu cấu trúc hệ thống từ Server...")
#         # Gọi API mới mà bạn sẽ viết bên Node.js (tên API do bạn tự định nghĩa)
#         response = requests.get("http://localhost:5000/api/ponds/gateway-init", timeout=5)
        
#         if response.status_code == 200:
#             server_ponds = response.json()

#             #reset lại ponds_data trước khi nạp mới
#             ponds_data = {}
            
#             for pond in server_ponds:
#                 gateway_id = str(pond.get("gateway_id")) # VD: "1" hoặc "2"
                
#                 # Nạp dữ liệu động vào ponds_data (dữ liệu mặt đính -> sẽ được đồng bộ và thay đổi sau)
#                 ponds_data[gateway_id] = {
#                     "ao_id": pond["ao_id"],
#                     "feeder_id": pond["feeder_id"],
#                     "config": {
#                         "TEMP": {"high": 28, "low": 25},
#                         "LIGHT": {"high": 40, "low": 9},
#                         "MODE": "AUTO"
#                     },
#                     "device_status": {
#                         "PUMP": "OFF",
#                         "FAN": "OFF",
#                         "FEEDER": "OFF"
#                     },
#                     "sensor_ids": pond["sensor_ids"], # Lấy dict sensor ids từ server
#                     "schedules": [],
#                     "is_feeding_logged": False # <--- THÊM DÒNG NÀY ĐỂ TRACKING
#                 }
#             print("✅ Đã khởi tạo cấu trúc ao thành công từ Database!")
            
#             # Sau khi có cấu trúc, lập tức đồng bộ config và lịch trình
#             # Sau khi có cấu trúc, lập tức đồng bộ config và lịch trình
#             for pond_key in ponds_data.keys():
#                 sync_config_from_server(pond_key)
#                 sync_schedules_from_server(pond_key)
                
#             # ĐỒNG BỘ GROUP VÀ FEEDS LÊN ADAFRUIT IO
#             sync_adafruit_structure(ponds_data)
                
#         else:
#             print(f"❌ Lỗi tải dữ liệu ao: Server trả về mã {response.status_code}")
#     except Exception as e:
#         print(f"❌ Không thể kết nối tới Server để khởi tạo dữ liệu: {e}")
#         sys.exit() # Nếu không load được dữ liệu gốc thì nên dừng chương trình

# # ==========================================
# # CÁC HÀM GIAO TIẾP SERVER & ĐIỀU KHIỂN
# # ==========================================

# def sync_schedules_from_server(pond_key):
#     try:
#         feeder_id = ponds_data[pond_key]["feeder_id"]
#         response = requests.get(f"http://localhost:5000/api/devices/gateway/{feeder_id}", timeout=3)
#         if response.status_code == 200:
#             ponds_data[pond_key]["schedules"] = response.json().get("schedules", [])
#             print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Đã đồng bộ Lịch trình ao {pond_key} thành công!")
#     except Exception as e:
#         print(f"Lỗi đồng bộ lịch trình ao {pond_key}: {e}")

# def get_active_schedule(pond_key):
#     now_time = datetime.datetime.now().time()

#     for sched in ponds_data[pond_key].get("schedules", []):
#         try:
#             start = datetime.datetime.strptime(sched["start_time"], "%H:%M:%S").time()
#             end = datetime.datetime.strptime(sched["end_time"], "%H:%M:%S").time()

#             if start <= now_time <= end:
#                 return sched
#         except Exception:
#             continue

#     return None

# def sync_config_from_server(pond_key):
#     try:
#         ao_id = ponds_data[pond_key]["ao_id"]
#         response = requests.get(f"http://localhost:5000/api/ponds/{ao_id}/config", timeout=3)
#         if response.status_code == 200:
            
#             data = response.json()
#             # 1. Update the Pond Mode from the database payload
#             # (Assuming your backend API sends { che_do: 'AUTO', configs: [...] })
#             db_mode = data.get("che_do", "AUTO") 
#             ponds_data[pond_key]["config"]["MODE"] = db_mode

#             server_configs = response.json().get("configs", [])            
#             # Cập nhật lại biến config của từng ao
#             for item in server_configs:
#                 loai = item["LoaiCamBien"]
#                 if loai == "TEMP":
#                     ponds_data[pond_key]["config"]["TEMP"]["low"] = item["min_value"]
#                     ponds_data[pond_key]["config"]["TEMP"]["high"] = item["max_value"]
#                 elif loai == "LIGHT":
#                     ponds_data[pond_key]["config"]["LIGHT"]["low"] = item["min_value"]
#                     ponds_data[pond_key]["config"]["LIGHT"]["high"] = item["max_value"]
            
#             print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Đã đồng bộ cấu hình ao {pond_key} từ Server!")
#     except Exception as e:
#         print(f"Lỗi đồng bộ cấu hình ao {pond_key}: {e}")


# #hàm đồng bộ trạng thái thiết bị từ server, để đảm bảo khi có lệnh thủ công từ app thì gateway cũng nhận được và cập nhật lại trạng thái thiết bị cho đúng
# def sync_device_status_from_server(pond_key):
#     try:
#         ao_id = ponds_data[pond_key]["ao_id"]
#         response = requests.get(f"http://localhost:5000/api/devices/gateway/status/{ao_id}", timeout=3)
#         if response.status_code == 200:
#             server_devices = response.json().get("devices", [])
            
#             for dev in server_devices:
#                 # Map DB status (HOAT_DONG/TAT) to Gateway action (ON/OFF)
#                 action = "ON" if dev["trang_thai"] == "HOAT_DONG" else "OFF"
#                 device_name = dev["loai_thiet_bi"] # e.g., AERATOR, PUMP
                
#                 # If server status is different from current status, execute command
#                 if ponds_data[pond_key]["device_status"].get(device_name) != action:
#                     print(f"🔄 Đã nhận lệnh thủ công từ Server: {device_name} -> {action}")
#                     control_device(pond_key, device_name, action)

#     except Exception as e:
#         print(f"Lỗi đồng bộ trạng thái thiết bị ao {pond_key}: {e}")

# # Hàm điều khiển thiết bị, gửi lệnh xuống mạch khi vượt ngưỡng
# def control_device(pond_key, device_name, action):
#     global isMicrobitConnected

#     if ponds_data[pond_key]["device_status"][device_name] != action:
#         ponds_data[pond_key]["device_status"][device_name] = action

#         print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] LỆNH ĐIỀU KHIỂN AO {pond_key}: {device_name} -> {action}")

#         device_name_clean = device_name.strip().upper()
#         pond_number = "_".join(pond_key.split("_")[1:])

#         device_id = f"DK_{device_name_clean}_{pond_number}"

#         db_status = "HOAT_DONG" if action == "ON" else "TAT"

#         #UPDATE DEVICE STATUS chắc cần auth nhưng thôi kệ không ảnh hưởng gì => bỏ auth bên backend?
#         try:
#             res = requests.put(
#                 f"http://localhost:5000/api/devices/{device_id}/status",
#                 json={"trang_thai": db_status},
#                 timeout=3
#             )
#             #print("PUT status:", res.status_code)
#         except Exception as e:
#             print("❌ Lỗi update status:", e)

#         #FEEDING LOGIC để ghi vào lịch sử cho ăn
#         if device_name_clean == "FEEDER":
#             if action == "ON" and not ponds_data[pond_key]["is_feeding_logged"]:
#                 ponds_data[pond_key]["is_feeding_logged"] = True

#                 active_schedule = get_active_schedule(pond_key)
#                 ma_cong_thuc = active_schedule.get("ma_cong_thuc") if active_schedule else None

#                 try:
#                     res = requests.post(
#                         "http://localhost:5000/api/devices/feeding-history",
#                         json={
#                             "ma_cong_thuc": ma_cong_thuc,
#                             "ma_tb_dieu_khien": device_id,
#                             "muc_do_them_an": None,
#                             "bang_chung_hinh_anh": None
#                         },
#                         timeout=3
#                     )

#                     print("POST status:", res.status_code)
#                     print("POST response:", res.text)

#                 except Exception as e:
#                     print("❌ Lỗi gọi API:", e)

#             elif action == "OFF":
#                 ponds_data[pond_key]["is_feeding_logged"] = False
#         # -------------------------------------------
#         # Gửi dữ liệu trạng thái thiết bị lên Adafruit tự động
#         ao_id = ponds_data[pond_key]["ao_id"]
#         publish_device_data(ao_id, device_name_clean, action)

#         if isMicrobitConnected:
#             try:
#                 # Gửi lệnh kèm ID ao. VD: "!1:FAN:ON#" hoặc "!2:PUMP:OFF#"
#                 command = f"!{pond_key}:{device_name}:{action}#\n"
#                 ser.write(command.encode("UTF-8"))
#             except Exception as e:
#                 print(f"❌ Lỗi gửi lệnh xuống mạch ao {pond_key}: {e}")

# # Logic điều khiển bật tắt thiết bị dựa trên ngưỡng cảm biến và chế độ AUTO/MANUAL
# def processData(pond_key, sensor_type, value):
#     if pond_key not in ponds_data:
#         print(f"⚠️ Không tìm thấy cấu hình cho Ao ID: {pond_key}")
#         return

#     # Lấy cấu hình và sensor_ids tương ứng với ao hiện tại
#     config = ponds_data[pond_key]["config"]
#     sensor_ids = ponds_data[pond_key]["sensor_ids"]

#     #Debug: In thông tin cảm biến nhận được
#     print(f"Ao {pond_key} - Cảm biến {sensor_type} đo được: {value}")
    
#     # Chỉ tự động chạy nếu đang ở chế độ AUTO
#     if config["MODE"] == "AUTO":
#         # if sensor_type == "DO":
#         #     if value < config["DO"]["min"]:
#         #         control_device(pond_key, "AERATOR", "ON")
#         #     elif value > config["DO"]["max"]:
#         #         control_device(pond_key, "AERATOR", "OFF")
            
                
#         if sensor_type == "TEMP":
#             if value > config["TEMP"]["high"]:
#                 control_device(pond_key, "FAN", "ON")
#             elif value <= config["TEMP"]["low"]:
#                 control_device(pond_key, "FAN", "OFF")

#         elif sensor_type == "LIGHT":
#             if value > config["LIGHT"]["high"]:
#                 control_device(pond_key, "PUMP", "ON")
#             elif value <= config["LIGHT"]["low"]:
#                 control_device(pond_key, "PUMP", "OFF")

#     # Gửi dữ liệu về backend    
#     try:
#         device_id = sensor_ids.get(sensor_type, "CB_UNKNOWN")
#         res = requests.post("http://localhost:5000/api/sensors", json={
#             "device_id": device_id, 
#             "value": value
#         })
        
#         if res.status_code == 200:
#             print(f"  -> Đã gửi {sensor_type} (Ao {pond_key}) lên Server. OK")
#         else:
#             print(f"  -> SERVER BÁO LỖI: {res.status_code} - Chi tiết: {res.text}")
#     except Exception as e:
#         print(f"  -> LỖI GỬI API SENSOR: {e}")

#     # Lấy chuẩn Device ID (VD: CB_TEMP_AO_01) và đẩy lên Adafruit
#     publish_sensor_data(device_id, value)


# def check_feeder_schedule():
#     now_time = datetime.datetime.now().time() 
    
#     # Kiểm tra lịch cho cả 2 ao
#     for pond_key, data in ponds_data.items():
#         schedules = data["schedules"]
#         should_run = False
        
#         for sched in schedules:
#             try:
#                 start = datetime.datetime.strptime(sched["start_time"], "%H:%M:%S").time()
#                 end = datetime.datetime.strptime(sched["end_time"], "%H:%M:%S").time()
                
#                 if start <= now_time <= end:
#                     should_run = True
#                     break
#             except ValueError:
#                 print(f"  -> Lỗi parsing thời gian lịch trình ao {pond_key}: {sched}")
                
#         if should_run:
#             control_device(pond_key, "FEEDER", "ON")
#         else:
#             control_device(pond_key, "FEEDER", "OFF")
        

# #kiểm tra kết nối với microbit, nếu kết nối được thì đọc dữ liệu thực tế, nếu không thì fake dữ liệu để test
# isMicrobitConnected = False
# try:
#     ser = serial.Serial(port="COM6", baudrate=115200, timeout=1)
#     isMicrobitConnected = True
#     print("✅ Đã kết nối thành công với mạch trên cổng COM")
# except Exception as e:
#     print(f"❌ Lỗi kết nối cổng Serial COM: {e}")
#     isMicrobitConnected = False

# # Khởi tạo kết nối với Adafruit IO
# init_adafruit()


# mess = "" 
# # Hàm phân tích dữ liệu Serial nhận được từ mạch
# def parseSerialData(data_string):
#     try:
#         clean_data = data_string.replace("!", "").replace("#", "")
#         splitData = clean_data.split(":")

#         if len(splitData) >= 3:
#             pond_key = splitData[0]
#             item_type = splitData[1]
#             raw_value = splitData[2]

#             # Nếu là cảm biến số
#             if item_type in ["TEMP", 'LIGHT']:
#                 value = float(raw_value)
#                 print(f"Nhận dữ liệu cảm biến: Ao {pond_key} - {item_type} = {value}")
#                 processData(pond_key, item_type, value)

#             # Nếu là trạng thái thiết bị
#             elif item_type in ["FAN", "PUMP", "FEEDER", "AERATOR"]:
#                 print(f"Thiết bị phản hồi: Ao {pond_key} - {item_type} = {raw_value}")

#     except Exception as e:
#         print(f"Lỗi Serial: {data_string} -> {e}")

# #đọc dữ liệu từ cổng serial, tìm kiếm chuỗi dữ liệu hoàn chỉnh nằm giữa '!' và '#', sau đó gọi hàm parseSerialData để xử lý
# def readSerial():
#     global mess
#     if not isMicrobitConnected:
#         return

#     try:
#         bytesToRead = ser.inWaiting()
#         if bytesToRead > 0:
#             mess = mess + ser.read(bytesToRead).decode("UTF-8")
#             while ("#" in mess) and ("!" in mess):
#                 start = mess.find("!")
#                 end = mess.find("#")
                
#                 if start < end:
#                     data = mess[start:end + 1]
#                     parseSerialData(data) 
                    
#                 if end == len(mess) - 1:
#                     mess = ""
#                 else:
#                     mess = mess[end+1:]
#     except Exception as e:
#         pass


# latest_real_temp= 27.0
# latest_real_light = 20.0
# real_temp_pond_id = None
# # Hàm tạo dữ liệu giả cho DO, PH và TEMP (chỉ fake TEMP cho ao không có cảm biến thật)
# def fakeSerial():
#     global latest_real_temp, latest_real_light, real_temp_pond_id
    
#     # Tạo dữ liệu giả định kỳ cho các ao
#     for pond_key in ponds_data.keys():
        
#         # # 1. Luôn fake DO và PH cho tất cả các ao
#         # fake_do = round(random.uniform(4.5, 7.5), 1)     
#         # fake_ph = round(random.uniform(6.0, 8.5), 1) 
#         # processData(pond_key, "DO", fake_do)
#         # processData(pond_key, "PH", fake_ph)

#         # 2. Fake TEMP cho các ao KHÔNG có cảm biến thật
#         if pond_key != real_temp_pond_id:
#             # Tạo nhiệt độ ảo chênh lệch một chút (+- 0.5 độ) so với ao có cảm biến thật
#             fake_temp = round(latest_real_temp + random.uniform(-5, 2), 1)
#             processData(pond_key, "TEMP", fake_temp)
#             fake_light = round(latest_real_light + random.uniform(-20, 30), 1)
#             processData(pond_key, "LIGHT", fake_light)

# # Hàm kiểm tra tín hiệu reload từ server để cập nhật lại cấu trúc ao nếu có thay đổi
# def check_reload_signal():
#     global ponds_data
#     try:
#         # Gọi API check-reload với timeout rất ngắn để không treo vòng lặp
#         response = requests.get("http://localhost:5000/api/ponds/check-reload", timeout=1)
#         if response.status_code == 200:
#             data = response.json()
#             if data.get("reload") == True:
#                 print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Phát hiện thay đổi cấu trúc ao! Đang cập nhật...")
                
#                 # Gọi lại hàm khởi tạo để cập nhật ponds_data
#                 init_ponds_data_from_server()
                
#     except Exception as e:
#         # Không in lỗi quá nhiều nếu server chỉ mất kết nối tạm thời
#         pass


# # ==========================================
# # VÒNG LẶP CHÍNH
# # ==========================================
# #gọi để lấy dữ liệu cấu trúc ao từ db duy nhất 1 lần
# init_ponds_data_from_server()

# sync_counter = 0

# while True:
#     # 1. Định kỳ đồng bộ cấu hình cho tất cả các ao
#     for pond_key in list(ponds_data.keys()):
#         sync_config_from_server(pond_key)
#         sync_schedules_from_server(pond_key)
#         sync_device_status_from_server(pond_key)
#     # if sync_counter % 3 == 0: 
#     #     for pond_key in list(ponds_data.keys()):
#     #         #cập nhật thay đổi cấu hình và lịch trình từ server, đồng thời cập nhật trạng thái thiết bị để đồng bộ với lệnh thủ công từ app
#     #         sync_config_from_server(pond_key)
#     #         sync_schedules_from_server(pond_key)
#     #         sync_device_status_from_server(pond_key)
#     # sync_counter += 1

#     # 2. Đọc dữ liệu thực tế từ mạch và tạo dữ liệu giả
#     if isMicrobitConnected:
#         readSerial()
#     else:
#         fakeSerial() 

#     # 3. Kiểm tra lịch cho ăn
#     check_feeder_schedule()

#     # 4. Kiểm tra tín hiệu reload khi có thay đổi (vd: thêm/sửa/xóa ao, thiết bị, cảm biến...)
#     check_reload_signal()
    
#     time.sleep(30)

import serial.tools.list_ports
import requests
import random
import time
import datetime
import sys
# from Adafruit_IO import MQTTClient

# ==========================================
# CẤU TRÚC DỮ LIỆU CHO 2 AO NUÔI
# ==========================================
ponds_data = {
    "1": { # Tương ứng với ao 1 (ID từ mạch gửi lên: !1:TEMP:32.5#)
        "ao_id": "AO_01",
        "feeder_id": "DK_FEEDER_01",
        "config": {
            "DO": {"min": 5.0, "max": 7.0},
            "PH": {"min": 5.0, "max": 8.0},
            "TEMP": {"high": 28, "low": 25},
            "MODE": "AUTO"
        },
        "device_status": {
            "AERATOR": "OFF",
            "PUMP": "OFF",
            "FAN": "OFF",
            "FEEDER": "OFF"
        },
        "sensor_ids": {
            "TEMP": "CB_TEMP_01",
            "DO": "CB_DO_01",
            "PH": "CB_PH_01"
        },
        "schedules": []
    },
    "2": { # Tương ứng với ao 2 (ID từ mạch gửi lên: !2:TEMP:32.5#)
        "ao_id": "AO_02",
        "feeder_id": "DK_FEEDER_02", # ID máy cho ăn của ao 2
        "config": {
            "DO": {"min": 5.0, "max": 7.0},
            "PH": {"min": 5.0, "max": 8.0},
            "TEMP": {"high": 28, "low": 25},
            "MODE": "AUTO"
        },
        "device_status": {
            "AERATOR": "OFF",
            "PUMP": "OFF",
            "FAN": "OFF",
            "FEEDER": "OFF"
        },
        "sensor_ids": {
            "TEMP": "CB_TEMP_02", # Các ID này phải khớp với database
            "DO": "CB_DO_02",
            "PH": "CB_PH_02"
        },
        "schedules": []
    }
}

# ==========================================
# CÁC HÀM GIAO TIẾP SERVER & ĐIỀU KHIỂN
# ==========================================

def sync_schedules_from_server(pond_key):
    try:
        feeder_id = ponds_data[pond_key]["feeder_id"]
        response = requests.get(f"http://127.0.0.1:5000/api/devices/gateway/{feeder_id}", timeout=3)
        if response.status_code == 200:
            ponds_data[pond_key]["schedules"] = response.json().get("schedules", [])
            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Đã đồng bộ Lịch trình ao {pond_key} thành công!")
    except Exception as e:
        print(f"Lỗi đồng bộ lịch trình ao {pond_key}: {e}")


def sync_config_from_server(pond_key):
    try:
        ao_id = ponds_data[pond_key]["ao_id"]
        response = requests.get(f"http://127.0.0.1:5000/api/ponds/{ao_id}/config", timeout=3)
        if response.status_code == 200:
            server_configs = response.json().get("configs", [])
            
            # Cập nhật lại biến config của từng ao
            for item in server_configs:
                loai = item["LoaiCamBien"]
                if loai == "TEMP":
                    ponds_data[pond_key]["config"]["TEMP"]["low"] = item["min_value"]
                    ponds_data[pond_key]["config"]["TEMP"]["high"] = item["max_value"]
                elif loai in ["DO", "PH"]:
                    ponds_data[pond_key]["config"][loai]["min"] = item["min_value"]
                    ponds_data[pond_key]["config"][loai]["max"] = item["max_value"]
            
            print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Đã đồng bộ cấu hình ao {pond_key} từ Server!")
    except Exception as e:
        print(f"Lỗi đồng bộ cấu hình ao {pond_key}: {e}")


def control_device(pond_key, device_name, action):
    global isMicrobitConnected
    
    # Kiểm tra trạng thái hiện tại, nếu khác thì mới gửi lệnh
    if ponds_data[pond_key]["device_status"][device_name] != action:
        ponds_data[pond_key]["device_status"][device_name] = action
        print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] LỆNH ĐIỀU KHIỂN AO {pond_key}: {device_name} -> {action}")
        
        if isMicrobitConnected:
            try:
                # Gửi lệnh kèm ID ao. VD: "!1:FAN:ON#" hoặc "!2:PUMP:OFF#"
                command = f"!{pond_key}:{device_name}:{action}#\n"
                ser.write(command.encode("UTF-8"))
            except Exception as e:
                print(f"❌ Lỗi gửi lệnh xuống mạch ao {pond_key}: {e}")


def processData(pond_key, sensor_type, value):
    if pond_key not in ponds_data:
        print(f"⚠️ Không tìm thấy cấu hình cho Ao ID: {pond_key}")
        return

    config = ponds_data[pond_key]["config"]
    sensor_ids = ponds_data[pond_key]["sensor_ids"]

    print(f"Ao {pond_key} - Cảm biến {sensor_type} đo được: {value}")
    
    # Chỉ tự động chạy nếu đang ở chế độ AUTO
    if config["MODE"] == "AUTO":
        if sensor_type == "DO":
            if value < config["DO"]["min"]:
                control_device(pond_key, "AERATOR", "ON")
            elif value > config["DO"]["max"]:
                control_device(pond_key, "AERATOR", "OFF")
                
        elif sensor_type == "PH":
            if value < config["PH"]["min"] or value > config["PH"]["max"]:
                control_device(pond_key, "PUMP", "ON")
            else:
                control_device(pond_key, "PUMP", "OFF")
                
        elif sensor_type == "TEMP":
            if value > config["TEMP"]["high"]:
                control_device(pond_key, "FAN", "ON")
            elif value <= config["TEMP"]["low"]:
                control_device(pond_key, "FAN", "OFF")

    # Gửi dữ liệu về backend
    try:
        device_id = sensor_ids.get(sensor_type, "CB_UNKNOWN")
        res = requests.post("http://127.0.0.1:5000/api/sensors", json={
            "device_id": device_id, 
            "value": value
        })
        
        if res.status_code == 200:
            print(f"  -> Đã gửi {sensor_type} (Ao {pond_key}) lên Server. OK")
        else:
            print(f"  -> SERVER BÁO LỖI: {res.status_code} - Chi tiết: {res.text}")
    except Exception as e:
        print(f"  -> LỖI GỬI API SENSOR: {e}")


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

# ==========================================
# SERIAL GIAO TIẾP VỚI MẠCH
# ==========================================
isMicrobitConnected = False
try:
    ser = serial.Serial(port="COM3", baudrate=115200, timeout=1)
    isMicrobitConnected = True
    print("✅ Đã kết nối thành công với mạch trên cổng COM3")
except Exception as e:
    print(f"❌ Lỗi kết nối cổng Serial COM: {e}")
    isMicrobitConnected = False



# Biến toàn cục lưu nhiệt độ thật gần nhất nhận được
latest_real_temp = 28.5  # Giá trị mặc định ban đầu
real_temp_pond_id = "1"  # Mặc định ao 1 là ao có gắn cảm biến thật

mess = "" 

def parseSerialData(data_string):
    global latest_real_temp, real_temp_pond_id
    """
    Chuỗi giả định mạch gửi lên: !<POND_ID>:<LOẠI_CẢM_BIẾN>:<GIÁ_TRỊ>#
    """
    try:
        clean_data = data_string.replace("!", "").replace("#", "")
        splitData = clean_data.split(":")
        
        if len(splitData) >= 3:
            pond_key = splitData[0]     
            sensor_type = splitData[1]  
            value = float(splitData[2]) 

            # Nếu nhận được nhiệt độ thật từ mạch, lưu lại làm chuẩn
            if sensor_type == "TEMP":
                latest_real_temp = value
                real_temp_pond_id = pond_key # Cập nhật ID ao đang sở hữu cảm biến thật

            # Xử lý và lưu dữ liệu bình thường
            processData(pond_key, sensor_type, value)
    except Exception as e:
        print(f"⚠️ Lỗi phân tích dữ liệu Serial: {data_string} -> {e}")


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


def fakeSerial():
    global latest_real_temp, real_temp_pond_id
    
    # Tạo dữ liệu giả định kỳ cho các ao
    for pond_key in ponds_data.keys():
        
        # 1. Luôn fake DO và PH cho tất cả các ao
        fake_do = round(random.uniform(4.5, 7.5), 1)     
        fake_ph = round(random.uniform(6.0, 8.5), 1) 
        processData(pond_key, "DO", fake_do)
        processData(pond_key, "PH", fake_ph)

        # 2. Fake TEMP cho các ao KHÔNG có cảm biến thật
        if pond_key != real_temp_pond_id:
            # Tạo nhiệt độ ảo chênh lệch một chút (+- 0.5 độ) so với ao có cảm biến thật
            fake_temp = round(latest_real_temp + random.uniform(-0.5, 0.5), 1)
            processData(pond_key, "TEMP", fake_temp)


# ==========================================
# VÒNG LẶP CHÍNH
# ==========================================
sync_counter = 0

while True:
    # 1. Định kỳ đồng bộ cấu hình cho tất cả các ao
    if sync_counter % 3 == 0:
        for pond_key in ponds_data.keys():
            sync_config_from_server(pond_key)
            sync_schedules_from_server(pond_key)
    sync_counter += 1

    # 2. Đọc dữ liệu
    if isMicrobitConnected:
        readSerial()
        fakeSerial() # Uncomment dòng này nếu muốn test chạy bằng data ảo
    else:
        pass

    # 3. Kiểm tra lịch cho ăn
    check_feeder_schedule()
    
    time.sleep(3)





















# #chạy được thiết bị nhưng với 1 ao
# import serial.tools.list_ports
# import requests
# import random
# import time
# import datetime
# import sys
# from Adafruit_IO import MQTTClient


# schedules = []

# config = {
#     "DO": {"min": 5.0, "max": 7.0},   # Oxy < 5 -> Bật sục khí, > 7 -> Tắt sục khí
#     "PH": {"min": 5.0, "max": 8.0},   # pH ngoài khoảng 5-8 -> Bật bơm, trong khoảng -> Tắt
#     "TEMP": {"high": 28, "low": 25}, # Nhiệt độ > 40 -> Bật quạt, < 30 -> Tắt quạt
#     "MODE": "AUTO" # Chế độ: AUTO hoặc MANUAL
# }

# # Trạng thái thiết bị hiện tại
# device_status = {
#     "AERATOR": "OFF", # Máy sục khí
#     "PUMP": "OFF",    # Máy bơm
#     "FAN": "OFF",     # Quạt
#     "FEEDER": "OFF"   # Máy cho ăn
# }

# sensor_id_map = {
#     "TEMP": "CB_TEMP_01",
#     "DO": "CB_DO_01",
#     "PH": "CB_PH_01"
# }

# # Thêm hàm đồng bộ lịch trình từ server
# def sync_schedules_from_server(tbtaibien_id="DK_FEEDER_01"): # Sử dụng string ID
#     global schedules
#     try:
#         # Đường dẫn route đã được chuẩn hóa trong routes/devices.js
#         response = requests.get(f"http://127.0.0.1:5000/api/devices/gateway/{tbtaibien_id}", timeout=3)
#         if response.status_code == 200:
#             schedules = response.json().get("schedules", [])
#             print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Đã đồng bộ Lịch trình thành công!")
#     except Exception as e:
#         print(f"Lỗi đồng bộ lịch trình: {e}")

# # config threshold
# def sync_config_from_server(ao_id="AO_01"): # Sử dụng string ID
#     global config
#     try:
#         # Gọi API lấy cấu hình từ Backend
#         response = requests.get(f"http://127.0.0.1:5000/api/ponds/{ao_id}/config", timeout=3)
#         if response.status_code == 200:
#             server_configs = response.json().get("configs", [])
            
#             # Cập nhật lại biến config của Gateway từ dữ liệu Database
#             for item in server_configs:
#                 loai = item["LoaiCamBien"] # VD: "TEMP", "DO", "PH"
#                 if loai == "TEMP":
#                     config["TEMP"]["low"] = item["min_value"]
#                     config["TEMP"]["high"] = item["max_value"]
#                 elif loai in ["DO", "PH"]:
#                     config[loai]["min"] = item["min_value"]
#                     config[loai]["max"] = item["max_value"]
            
#             print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Đã đồng bộ cấu hình từ Server thành công!")
#     except Exception as e:
#         print(f"Lỗi đồng bộ cấu hình (Server có thể đang tắt): {e}")


# #gửi lệnh điều khiển xuống mạch vd như control_device("FAN", "ON") hoặc control_device("PUMP", "OFF")
# def control_device(device_name, action):
#     global device_status, isMicrobitConnected
#     if device_status[device_name] != action:
#         device_status[device_name] = action
#         print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] LỆNH ĐIỀU KHIỂN: {device_name} -> {action}")
        
#         # --- THÊM ĐOẠN NÀY ĐỂ GỬI LỆNH XUỐNG MẠCH ---
#         if isMicrobitConnected:
#             try:
#                 # Đóng gói lệnh gửi xuống, ví dụ: "!FAN:ON#" hoặc "!FAN:OFF#"
#                 command = f"!{device_name}:{action}#\n"
#                 # print(command) # Debug: In lệnh trước khi gửi
#                 ser.write(command.encode("UTF-8"))
#             except Exception as e:
#                 print(f"❌ Lỗi gửi lệnh xuống mạch: {e}")

# #logic điều khiển bặt tắt thiết bị
# def processData(sensor_type, value):
#     global config
#     if sensor_type == "TEMP":
#         print("\n===== DEBUG =====")
#     print(f"Cảm biến {sensor_type} đo được: {value}")
    
#     # Chỉ tự động chạy nếu đang ở chế độ AUTO
#     if config["MODE"] == "AUTO":
#         if sensor_type == "DO":
#             if value < config["DO"]["min"]:
#                 control_device("AERATOR", "ON")
#             elif value > config["DO"]["max"]:
#                 control_device("AERATOR", "OFF")
                
#         elif sensor_type == "PH":
#             if value < config["PH"]["min"] or value > config["PH"]["max"]:
#                 control_device("PUMP", "ON")
#             else:
#                 control_device("PUMP", "OFF")
                
#         elif sensor_type == "TEMP":
#             if value > config["TEMP"]["high"]:
#                 control_device("FAN", "ON")
#             elif value <= config["TEMP"]["low"]:
#                 control_device("FAN", "OFF")

#     # Gửi dữ liệu về backend
#     try:
#         # Schema2: Bỏ tự sinh "id", Database xử lý AUTO_INCREMENT
#         res = requests.post("http://127.0.0.1:5000/api/sensors", json={
#             "device_id": sensor_id_map.get(sensor_type, "CB_UNKNOWN"), 
#             "value": value
#         })
        
#         if res.status_code == 200:
#             print(f"  -> Đã gửi {sensor_type} lên Server. Kết quả: 200 (OK)")
#         else:
#             print(f"  -> SERVER BÁO LỖI: {res.status_code} - Chi tiết: {res.text}")
            
#     except Exception as e:
#         print(f"  -> LỖI GỬI API SENSOR: {e}")


# #logic kiểm tra lịch cho ăn và bật/tắt máy cho ăn FEEDER 
# def check_feeder_schedule():
#     global schedules
#     # Chỉ lấy phần Time (Giờ:Phút:Giây)
#     now_time = datetime.datetime.now().time() 
    
#     should_run = False
#     for sched in schedules:
#         try:
#             # MySQL TIME format is "HH:MM:SS"
#             start = datetime.datetime.strptime(sched["start_time"], "%H:%M:%S").time()
#             end = datetime.datetime.strptime(sched["end_time"], "%H:%M:%S").time()
            
#             # Kiểm tra giờ hiện tại có nằm trong khoảng lịch trình không
#             if start <= now_time <= end:
#                 should_run = True
#                 break
#         except ValueError:
#             print(f"  -> Lỗi parsing thời gian lịch trình: {sched}")
            
#     if should_run:
#         control_device("FEEDER", "ON")
#     else:
#         control_device("FEEDER", "OFF")



# #kết nối với microbit
# isMicrobitConnected = False
# try:
#     # Kết nối trực tiếp vào COM với baudrate 115200 (chuẩn của OhStem/Microbit)
#     ser = serial.Serial(port="COM3", baudrate=115200, timeout=1)
#     isMicrobitConnected = True
#     print("✅ Đã kết nối thành công với mạch trên cổng COM5")
# except Exception as e:
#     print(f"❌ Lỗi kết nối cổng Serial COM: {e}")
#     isMicrobitConnected = False

# mess = "" # Bộ đệm chứa dữ liệu thô từ cổng serial



# #parse serial của micrrobit vd như !1:TEMP:32.5# hoặc !1:DO:6.5#
# def parseSerialData(data_string):
#     """
#     Hàm phân tích chuỗi dữ liệu nhận được.
#     Giả định mạch OhStem gửi chuỗi có định dạng: !<ID>:<LOẠI_CẢM_BIẾN>:<GIÁ_TRỊ>#
#     Ví dụ: !1:TEMP:32.5#
#     """
#     try:
#         # Xóa dấu ! và #
#         clean_data = data_string.replace("!", "").replace("#", "")
#         splitData = clean_data.split(":")
        
#         if len(splitData) >= 3:
#             sensor_type = splitData[1] # Lấy "TEMP" hoặc "DO"
#             value = float(splitData[2]) # Lấy giá trị số
#             processData(sensor_type, value)
#     except Exception as e:
#         print(f"⚠️ Lỗi phân tích dữ liệu Serial: {data_string} -> {e}")


# def readSerial():
#     """Hàm đọc dữ liệu liên tục từ cổng Serial"""
#     global mess
#     if not isMicrobitConnected:
#         return

#     try:
#         bytesToRead = ser.inWaiting()
#         if bytesToRead > 0:
#             # Đọc dữ liệu và giải mã
#             mess = mess + ser.read(bytesToRead).decode("UTF-8")
#             print(f"[DEBUG] Dữ liệu thô nhận được: {mess}")
#             # Tìm kiếm chuỗi dữ liệu hoàn chỉnh nằm giữa '!' và '#'
#             while ("#" in mess) and ("!" in mess):
#                 start = mess.find("!")
#                 end = mess.find("#")
                
#                 if start < end:
#                     data = mess[start:end + 1]
#                     parseSerialData(data) # Xử lý dữ liệu
                    
#                 if end == len(mess) - 1:
#                     mess = ""
#                 else:
#                     mess = mess[end+1:]
#     except Exception as e:
#         pass



# #fake serial cho DO và PH
# def fakeSerial():
#     # Chỉ tạo dữ liệu giả cho DO và PH để test bật/tắt PUMP và AERATOR
#     fake_do = round(random.uniform(3.0, 8.0), 1)     
#     fake_ph = round(random.uniform(3.0, 9.0), 1) 

#     processData("DO", fake_do)
#     processData("PH", fake_ph)



# # ==========================================
# # VÒNG LẶP CHÍNH (CẬP NHẬT)
# # ==========================================
# sync_counter = 0
# last_upload_time = time.time()

# while True:
#     # print(".", end="", flush=True)
#     # 1. Định kỳ đồng bộ cấu hình (Khoảng 3s một lần)
#     if sync_counter % 3 == 0:
#         sync_config_from_server(ao_id="AO_01")
#         sync_schedules_from_server(tbtaibien_id="DK_FEEDER_01")
#     sync_counter += 1

#     # 2. Đọc dữ liệu từ cảm biến thực tế
#     if isMicrobitConnected:
#         readSerial()
#         fakeSerial()
#     else:
#         pass

#     # 3. Kiểm tra lịch cho ăn
#     check_feeder_schedule()
    
#     # Giảm thời gian sleep xuống 1 giây (hoặc nhỏ hơn) để tránh bị tràn bộ đệm Serial
#     time.sleep(3)

















##initial
# import serial.tools.list_ports
# import requests
# import random
# import time
# import datetime
# import sys
# from Adafruit_IO import MQTTClient


# schedules = []

# config = {
#     "DO": {"min": 5.0, "max": 7.0},   # Oxy < 5 -> Bật sục khí, > 7 -> Tắt sục khí
#     "PH": {"min": 5.0, "max": 8.0},   # pH ngoài khoảng 5-8 -> Bật bơm, trong khoảng -> Tắt
#     "TEMP": {"high": 28, "low": 25}, # Nhiệt độ > 40 -> Bật quạt, < 30 -> Tắt quạt
#     "MODE": "AUTO" # Chế độ: AUTO hoặc MANUAL
# }

# # Trạng thái thiết bị hiện tại
# device_status = {
#     "AERATOR": "OFF", # Máy sục khí
#     "PUMP": "OFF",    # Máy bơm
#     "FAN": "OFF",     # Quạt
#     "FEEDER": "OFF"   # Máy cho ăn
# }

# sensor_id_map = {
#     "TEMP": "CB_TEMP_01",
#     "DO": "CB_DO_01",
#     "PH": "CB_PH_01"
# }

# # Thêm hàm đồng bộ lịch trình từ server
# def sync_schedules_from_server(tbtaibien_id="DK_FEEDER_01"): # Sử dụng string ID
#     global schedules
#     try:
#         # Đường dẫn route đã được chuẩn hóa trong routes/devices.js
#         response = requests.get(f"http://127.0.0.1:5000/api/devices/gateway/{tbtaibien_id}", timeout=3)
#         if response.status_code == 200:
#             schedules = response.json().get("schedules", [])
#             print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Đã đồng bộ Lịch trình thành công!")
#     except Exception as e:
#         print(f"Lỗi đồng bộ lịch trình: {e}")

# # config threshold
# def sync_config_from_server(ao_id="AO_01"): # Sử dụng string ID
#     global config
#     try:
#         # Gọi API lấy cấu hình từ Backend
#         response = requests.get(f"http://127.0.0.1:5000/api/ponds/{ao_id}/config", timeout=3)
#         if response.status_code == 200:
#             server_configs = response.json().get("configs", [])
            
#             # Cập nhật lại biến config của Gateway từ dữ liệu Database
#             for item in server_configs:
#                 loai = item["LoaiCamBien"] # VD: "TEMP", "DO", "PH"
#                 if loai == "TEMP":
#                     config["TEMP"]["low"] = item["min_value"]
#                     config["TEMP"]["high"] = item["max_value"]
#                 elif loai in ["DO", "PH"]:
#                     config[loai]["min"] = item["min_value"]
#                     config[loai]["max"] = item["max_value"]
            
#             print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] Đã đồng bộ cấu hình từ Server thành công!")
#     except Exception as e:
#         print(f"Lỗi đồng bộ cấu hình (Server có thể đang tắt): {e}")


# #gửi lệnh điều khiển xuống mạch
# def control_device(device_name, action):
#     global device_status, isMicrobitConnected
#     if device_status[device_name] != action:
#         device_status[device_name] = action
#         print(f"[{datetime.datetime.now().strftime('%H:%M:%S')}] LỆNH ĐIỀU KHIỂN: {device_name} -> {action}")
        
#         # --- THÊM ĐOẠN NÀY ĐỂ GỬI LỆNH XUỐNG MẠCH ---
#         if isMicrobitConnected:
#             try:
#                 # Đóng gói lệnh gửi xuống, ví dụ: "!FAN:ON#" hoặc "!FAN:OFF#"
#                 command = f"!{device_name}:{action}#\n"
#                 # print(command) # Debug: In lệnh trước khi gửi
#                 ser.write(command.encode("UTF-8"))
#             except Exception as e:
#                 print(f"❌ Lỗi gửi lệnh xuống mạch: {e}")

# #logic điều khiển bặt tắt thiết bị
# def processData(sensor_type, value):
#     global config
#     if sensor_type == "TEMP":
#         print("\n===== DEBUG =====")
#     print(f"Cảm biến {sensor_type} đo được: {value}")
    
#     # Chỉ tự động chạy nếu đang ở chế độ AUTO
#     if config["MODE"] == "AUTO":
#         if sensor_type == "DO":
#             if value < config["DO"]["min"]:
#                 control_device("AERATOR", "ON")
#             elif value > config["DO"]["max"]:
#                 control_device("AERATOR", "OFF")
                
#         elif sensor_type == "PH":
#             if value < config["PH"]["min"] or value > config["PH"]["max"]:
#                 control_device("PUMP", "ON")
#             else:
#                 control_device("PUMP", "OFF")
                
#         elif sensor_type == "TEMP":
#             if value > config["TEMP"]["high"]:
#                 control_device("FAN", "ON")
#             elif value <= config["TEMP"]["low"]:
#                 control_device("FAN", "OFF")

#     # Gửi dữ liệu về backend
#     try:
#         # Schema2: Bỏ tự sinh "id", Database xử lý AUTO_INCREMENT
#         res = requests.post("http://127.0.0.1:5000/api/sensors", json={
#             "device_id": sensor_id_map.get(sensor_type, "CB_UNKNOWN"), 
#             "value": value
#         })
        
#         if res.status_code == 200:
#             print(f"  -> Đã gửi {sensor_type} lên Server. Kết quả: 200 (OK)")
#         else:
#             print(f"  -> SERVER BÁO LỖI: {res.status_code} - Chi tiết: {res.text}")
            
#     except Exception as e:
#         print(f"  -> LỖI GỬI API SENSOR: {e}")

# def check_feeder_schedule():
#     global schedules
#     # Chỉ lấy phần Time (Giờ:Phút:Giây)
#     now_time = datetime.datetime.now().time() 
    
#     should_run = False
#     for sched in schedules:
#         try:
#             # MySQL TIME format is "HH:MM:SS"
#             start = datetime.datetime.strptime(sched["start_time"], "%H:%M:%S").time()
#             end = datetime.datetime.strptime(sched["end_time"], "%H:%M:%S").time()
            
#             # Kiểm tra giờ hiện tại có nằm trong khoảng lịch trình không
#             if start <= now_time <= end:
#                 should_run = True
#                 break
#         except ValueError:
#             print(f"  -> Lỗi parsing thời gian lịch trình: {sched}")
            
#     if should_run:
#         control_device("FEEDER", "ON")
#     else:
#         control_device("FEEDER", "OFF")



# #kết nối với microbit
# isMicrobitConnected = False
# try:
#     # Kết nối trực tiếp vào COM với baudrate 115200 (chuẩn của OhStem/Microbit)
#     ser = serial.Serial(port="COM3", baudrate=115200, timeout=1)
#     isMicrobitConnected = True
#     print("✅ Đã kết nối thành công với mạch trên cổng COM5")
# except Exception as e:
#     print(f"❌ Lỗi kết nối cổng Serial COM: {e}")
#     isMicrobitConnected = False

# mess = "" # Bộ đệm chứa dữ liệu thô từ cổng serial



# #parse serial của micrrobit vd như !1:TEMP:32.5# hoặc !1:DO:6.5#
# def parseSerialData(data_string):
#     """
#     Hàm phân tích chuỗi dữ liệu nhận được.
#     Giả định mạch OhStem gửi chuỗi có định dạng: !<ID>:<LOẠI_CẢM_BIẾN>:<GIÁ_TRỊ>#
#     Ví dụ: !1:TEMP:32.5#
#     """
#     try:
#         # Xóa dấu ! và #
#         clean_data = data_string.replace("!", "").replace("#", "")
#         splitData = clean_data.split(":")
        
#         if len(splitData) >= 3:
#             sensor_type = splitData[1] # Lấy "TEMP" hoặc "DO"
#             value = float(splitData[2]) # Lấy giá trị số
#             processData(sensor_type, value)
#     except Exception as e:
#         print(f"⚠️ Lỗi phân tích dữ liệu Serial: {data_string} -> {e}")


# def readSerial():
#     """Hàm đọc dữ liệu liên tục từ cổng Serial"""
#     global mess
#     if not isMicrobitConnected:
#         return

#     try:
#         bytesToRead = ser.inWaiting()
#         if bytesToRead > 0:
#             # Đọc dữ liệu và giải mã
#             mess = mess + ser.read(bytesToRead).decode("UTF-8")
#             print(f"[DEBUG] Dữ liệu thô nhận được: {mess}")
#             # Tìm kiếm chuỗi dữ liệu hoàn chỉnh nằm giữa '!' và '#'
#             while ("#" in mess) and ("!" in mess):
#                 start = mess.find("!")
#                 end = mess.find("#")
                
#                 if start < end:
#                     data = mess[start:end + 1]
#                     parseSerialData(data) # Xử lý dữ liệu
                    
#                 if end == len(mess) - 1:
#                     mess = ""
#                 else:
#                     mess = mess[end+1:]
#     except Exception as e:
#         pass



# #fake serial cho DO và PH
# def fakeSerial():
#     # Chỉ tạo dữ liệu giả cho DO và PH để test bật/tắt PUMP và AERATOR
#     fake_do = round(random.uniform(3.0, 8.0), 1)     
#     fake_ph = round(random.uniform(3.0, 9.0), 1) 

#     processData("DO", fake_do)
#     processData("PH", fake_ph)



# # ==========================================
# # VÒNG LẶP CHÍNH (CẬP NHẬT)
# # ==========================================
# sync_counter = 0
# last_upload_time = time.time()

# while True:
#     # print(".", end="", flush=True)
#     # 1. Định kỳ đồng bộ cấu hình (Khoảng 3s một lần)
#     if sync_counter % 3 == 0:
#         sync_config_from_server(ao_id="AO_01")
#         sync_schedules_from_server(tbtaibien_id="DK_FEEDER_01")
#     sync_counter += 1

#     # 2. Đọc dữ liệu từ cảm biến thực tế
#     if isMicrobitConnected:
#         readSerial()
#         fakeSerial()
#     else:
#         pass

#     # 3. Kiểm tra lịch cho ăn
#     check_feeder_schedule()
    
#     # Giảm thời gian sleep xuống 1 giây (hoặc nhỏ hơn) để tránh bị tràn bộ đệm Serial
#     time.sleep(3)
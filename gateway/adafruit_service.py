from Adafruit_IO import MQTTClient

ADAFRUIT_AIO_USERNAME = "trinhthanhbinh"
ADAFRUIT_AIO_KEY = "aio_fUOy36txsFlrda5FaYRZoPjgMhiF"

client = None


def init_adafruit():
    global client
    try:
        client = MQTTClient(ADAFRUIT_AIO_USERNAME, ADAFRUIT_AIO_KEY)
        client.connect()
        client.loop_background()
        print("✅ Adafruit IO connected")
    except Exception as e:
        client = None
        print("❌ Adafruit IO error:", e)


def publish(feed, value):
    global client
    if client is None:
        return

    try:
        client.publish(feed, value)
        print(f"📤 {feed}: {value}")
    except Exception as e:
        print("Publish error:", e)


# ======================================
# PUBLISH SENSOR AO 1
# ======================================
def publish_sensor_pond1(sensor_type, value):
    sensor_type = sensor_type.upper()

    feeds = {
        "TEMP": "bbc-temp",
        "LIGHT": "bbc-light"
    }

    feed = feeds.get(sensor_type)
    if feed:
        publish(feed, value)


# ======================================
# PUBLISH DEVICE AO 1
# ======================================
def publish_device_pond1(device_name, action):
    device_name = device_name.upper()

    feeds = {
        "FAN": "bbc-fan",
        "PUMP": "bbc-pump",
        "FEEDER": "bbc-feeder"
    }

    feed = feeds.get(device_name)
    if feed:
        value = 1 if action == "ON" else 0
        publish(feed, value)



# from Adafruit_IO import MQTTClient, Client, Feed, Group, RequestError

# ADAFRUIT_AIO_USERNAME = "trinhthanhbinh"
# ADAFRUIT_AIO_KEY = "aio_fUOy36txsFlrda5FaYRZoPjgMhiF"

# client = None # Dùng cho MQTT (Realtime publish)
# rest_client = Client(ADAFRUIT_AIO_USERNAME, ADAFRUIT_AIO_KEY) # Dùng cho REST (Tạo/Xóa API)

# def init_adafruit():
#     global client
#     try:
#         client = MQTTClient(ADAFRUIT_AIO_USERNAME, ADAFRUIT_AIO_KEY)
#         client.connect()
#         client.loop_background()
#         print("✅ Đã kết nối MQTT Adafruit IO")
#     except Exception as e:
#         client = None
#         print("❌ Lỗi kết nối MQTT Adafruit IO:", e)

# def publish(feed_key, value):
#     global client
#     if client is None:
#         return
#     try:
#         client.publish(feed_key, value)
#         print(f"📤 Adafruit -> {feed_key}: {value}")
#     except Exception as e:
#         print("❌ Publish error:", e)

# # =======================================================
# # 1. HÀM ĐỒNG BỘ GROUP VÀ FEED TỰ ĐỘNG THEO DATABASE
# # =======================================================
# def sync_adafruit_structure(ponds_data):
#     print("🔄 Đang đồng bộ cấu trúc Group/Feed với Adafruit IO...")
#     try:
#         existing_groups = rest_client.groups()
#         existing_group_keys = [g.key for g in existing_groups]
#     except Exception as e:
#         print("❌ Lỗi gọi REST API Adafruit:", e)
#         return

#     # A. Phân tích cấu trúc cần thiết từ ponds_data
#     target_groups = {}
#     for gw_id, p_data in ponds_data.items():
#         ao_id = p_data["ao_id"] # VD: "AO_01"
#         group_name = f"TRAM_{ao_id}"
#         group_key = group_name.lower().replace("_", "-") # VD: tram-ao-01
        
#         feeds_list = []
#         # Danh sách cảm biến (VD: CB_TEMP_AO_01)
#         for s_type, s_id in p_data["sensor_ids"].items():
#             if s_id:
#                 feeds_list.append({"name": s_id, "key": s_id.lower().replace("_", "-")})
        
#         # Danh sách thiết bị điều khiển (VD: DK_FAN_AO_01)
#         for dev in ["PUMP", "FAN", "FEEDER", "AERATOR"]:
#             dev_id = f"DK_{dev}_{ao_id}"
#             feeds_list.append({"name": dev_id, "key": dev_id.lower().replace("_", "-")})
            
#         target_groups[group_key] = {"name": group_name, "feeds": feeds_list}

#     # B. Xóa những Group đã bị xóa khỏi Database
#     for g_key in existing_group_keys:
#         # Chỉ xóa group có prefix "tram-" để không lỡ tay xóa group khác của bạn
#         if g_key.startswith("tram-") and g_key not in target_groups:
#             try:
#                 group_to_del = rest_client.groups(g_key)
#                 # Dọn dẹp Feed trước khi xóa Group
#                 for feed in group_to_del.feeds:
#                     rest_client.delete_feed(feed.key)
#                     print(f"  🗑️ Đã xóa feed: {feed.key}")
                
#                 rest_client.delete_group(g_key)
#                 print(f"🗑️ Đã xóa group hoàn toàn: {g_key}")
#             except RequestError as e:
#                 print(f"❌ Lỗi xóa group {g_key}: {e}")

#     # C. Tạo mới Group & Feed nếu chưa tồn tại
#     for g_key, info in target_groups.items():
#         if g_key not in existing_group_keys:
#             try:
#                 rest_client.create_group(Group(name=info["name"], key=g_key))
#                 print(f"✅ Đã tạo group mới: {info['name']}")
#             except RequestError as e:
#                 print(f"❌ Lỗi tạo group {info['name']}: {e}")
        
#         for feed_info in info["feeds"]:
#             try:
#                 rest_client.feeds(feed_info["key"]) # Cố gắng lấy xem feed có chưa
#             except RequestError:
#                 # Nếu văng RequestError tức là chưa có -> tạo mới
#                 try:
#                     new_feed = Feed(name=feed_info["name"], key=feed_info["key"])
#                     rest_client.create_feed(new_feed, group_key=g_key)
#                     print(f"  ✅ Đã tạo feed: {feed_info['name']}")
#                 except RequestError as e:
#                     print(f"  ❌ Lỗi tạo feed {feed_info['name']}: {e}")

# # =======================================================
# # 2. HÀM PUBLISH DỮ LIỆU ĐỘNG (Dùng chung cho mọi Ao)
# # =======================================================
# def publish_sensor_data(sensor_id, value):
#     feed_key = sensor_id.lower().replace("_", "-")
#     publish(feed_key, value)

# def publish_device_data(ao_id, device_name, action):
#     dev_id = f"DK_{device_name.upper()}_{ao_id}"
#     feed_key = dev_id.lower().replace("_", "-")
#     value = 1 if action == "ON" else 0
#     publish(feed_key, value)
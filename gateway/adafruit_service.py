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
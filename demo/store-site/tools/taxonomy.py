"""Brambleway's departments, categories and the spec templates behind every generated product.

Everything here is made up for the demo: brand names, product lines, specs, prices. A category names its `kind` (which
spec template, image shape and variant scheme it uses), the nouns its products are called, a price range, and the
interests and audiences it suits (what the copilot narrows a gift request by).
"""

# kind -> specs. A spec is (name, choices) or (name, (lo, hi, step, unit)). The first spec is the one put in the title.
KINDS = {
    "pack": {"shape": "pack", "variants": "color", "specs": [
        ("Capacity", (12, 65, 2, "L")), ("Weight", (380, 1900, 20, "g")), ("Material", ["ripstop nylon", "recycled polyester", "waxed canvas", "Cordura-style nylon"]),
        ("Water resistance", ["splash resistant", "water resistant (IPX4)", "waterproof roll-top", "none"]), ("Laptop sleeve", ["none", "fits 13 in", "fits 15 in", "fits 16 in"]),
        ("Hip belt", ["yes, padded", "removable webbing", "no"]), ("Hydration compatible", ["yes", "no"])]},
    "shoe": {"shape": "shoe", "variants": "color+shoe", "specs": [
        ("Upper", ["full-grain leather", "engineered mesh", "suede and mesh", "knit"]), ("Waterproof", ["yes, membrane lined", "no", "water resistant"]),
        ("Sole", ["lugged rubber", "EVA foam", "carbon rubber", "gum rubber"]), ("Weight per shoe", (210, 720, 10, "g")), ("Heel-to-toe drop", (0, 12, 2, "mm")),
        ("Width", ["regular", "regular and wide"]), ("Ankle", ["low", "mid", "high"])]},
    "top": {"shape": "shirt", "variants": "color+apparel", "specs": [
        ("Material", ["100% cotton", "merino wool", "recycled polyester", "cotton-linen blend", "bamboo viscose"]), ("Fit", ["regular", "slim", "relaxed", "athletic"]),
        ("Sleeve", ["short", "long", "sleeveless", "three-quarter"]), ("Care", ["machine wash cold", "hand wash", "machine wash warm"]), ("UPF sun protection", ["none", "UPF 30", "UPF 50+"])]},
    "bottom": {"shape": "pants", "variants": "color+apparel", "specs": [
        ("Material", ["stretch nylon", "cotton twill", "denim", "recycled polyester", "fleece"]), ("Fit", ["regular", "slim", "relaxed", "tapered"]),
        ("Inseam", (26, 34, 2, "in")), ("Pockets", (2, 7, 1, "")), ("Care", ["machine wash cold", "machine wash warm"])]},
    "outer": {"shape": "jacket", "variants": "color+apparel", "specs": [
        ("Waterproof rating", (0, 20000, 5000, "mm")), ("Insulation", ["none", "synthetic 60 g", "synthetic 100 g", "down 600 fill", "down 800 fill", "fleece"]),
        ("Hood", ["yes, adjustable", "yes, stowable", "no"]), ("Weight", (180, 1200, 20, "g")), ("Packs into pocket", ["yes", "no"])]},
    "tent": {"shape": "tent", "variants": "color", "specs": [
        ("Sleeps", (1, 6, 1, "people")), ("Packed weight", (0.9, 6.5, 0.1, "kg")), ("Season rating", ["3-season", "3+ season", "4-season"]),
        ("Doors", (1, 2, 1, "")), ("Floor area", (1.8, 9.0, 0.1, "m²")), ("Setup", ["freestanding", "semi-freestanding", "trekking-pole"])]},
    "sleep": {"shape": "sleeping", "variants": "color", "specs": [
        ("Comfort rating", (-12, 10, 1, "°C")), ("Fill", ["synthetic", "down 650 fill", "down 800 fill"]), ("Weight", (450, 2400, 50, "g")), ("Shape", ["mummy", "rectangular", "quilt"])]},
    "bottle": {"shape": "bottle", "variants": "color", "specs": [
        ("Capacity", (350, 1900, 50, "ml")), ("Insulated", ["double-wall vacuum", "no"]), ("Keeps cold", (0, 36, 6, "h")), ("Material", ["18/8 stainless steel", "BPA-free Tritan", "glass with sleeve"]),
        ("Dishwasher safe", ["yes", "lid only", "no"]), ("Lid", ["straw lid", "chug cap", "screw cap", "flip spout"])]},
    "cookware": {"shape": "pan", "variants": "color", "specs": [
        ("Diameter", (16, 32, 2, "cm")), ("Material", ["tri-ply stainless steel", "cast iron", "hard-anodised aluminium", "carbon steel", "ceramic nonstick"]),
        ("Induction ready", ["yes", "no"]), ("Oven safe to", (180, 260, 20, "°C")), ("Dishwasher safe", ["yes", "no"])]},
    "appliance": {"shape": "appliance", "variants": "color", "specs": [
        ("Power", (600, 2200, 100, "W")), ("Capacity", (0.8, 6.0, 0.1, "L")), ("Programs", (1, 14, 1, "")), ("Warranty", ["1 year", "2 years", "3 years"]),
        ("Dishwasher-safe parts", ["yes", "no"])]},
    "phone": {"shape": "phone", "variants": "color+storage", "specs": [
        ("Screen", (5.8, 6.9, 0.1, "in")), ("Battery", (3800, 5500, 100, "mAh")), ("Main camera", (12, 64, 4, "MP")), ("Water resistance", ["IP54", "IP67", "IP68"]),
        ("Charging", ["25 W wired", "45 W wired, 15 W wireless", "33 W wired"]), ("Dual SIM", ["yes", "no"])]},
    "tablet": {"shape": "tablet", "variants": "color+storage", "specs": [
        ("Screen", (8.0, 13.0, 0.5, "in")), ("Battery life", (8, 15, 1, "h")), ("Pen support", ["yes", "no"]), ("Weight", (300, 690, 10, "g"))]},
    "laptop": {"shape": "laptop", "variants": "color+storage", "specs": [
        ("Screen", (13.0, 17.0, 0.5, "in")), ("Memory", ["8 GB", "16 GB", "32 GB"]), ("Processor", ["Q5 6-core", "Q7 8-core", "Q9 12-core"]),
        ("Battery life", (6, 20, 1, "h")), ("Weight", (1.1, 2.6, 0.1, "kg")), ("Ports", ["2× USB-C, headphone", "2× USB-C, 1× USB-A, HDMI", "3× USB-C, SD card, HDMI"])]},
    "audio": {"shape": "headphones", "variants": "color", "specs": [
        ("Battery life", (6, 60, 2, "h")), ("Noise cancelling", ["active", "passive"]), ("Bluetooth", ["5.2", "5.3", "5.4"]), ("Driver size", (6, 50, 2, "mm")),
        ("Water resistance", ["none", "IPX4", "IPX5", "IP67"]), ("Microphone", ["yes", "no"])]},
    "speaker": {"shape": "speaker", "variants": "color", "specs": [
        ("Battery life", (6, 30, 2, "h")), ("Output", (5, 60, 5, "W")), ("Water resistance", ["none", "IPX5", "IP67"]), ("Weight", (250, 2400, 50, "g")), ("Pairs with a second speaker", ["yes", "no"])]},
    "wearable": {"shape": "watch", "variants": "color", "specs": [
        ("Battery life", (1, 21, 1, "days")), ("GPS", ["built in", "uses phone"]), ("Water resistance", (30, 100, 20, "m")), ("Heart-rate sensor", ["yes", "no"]),
        ("Display", ["AMOLED", "memory-in-pixel", "LCD"]), ("Case size", (38, 50, 2, "mm"))]},
    "screen": {"shape": "monitor", "variants": "size", "specs": [
        ("Resolution", ["1920×1080", "2560×1440", "3840×2160"]), ("Refresh rate", (60, 240, 60, "Hz")), ("Panel", ["IPS", "VA", "OLED"]), ("Ports", ["2× HDMI, DisplayPort", "HDMI, USB-C 65 W", "3× HDMI, optical"])]},
    "camera": {"shape": "camera", "variants": "color", "specs": [
        ("Sensor", (12, 45, 1, "MP")), ("Video", ["1080p", "4K 30 fps", "4K 60 fps"]), ("Zoom", ["none", "3×", "5×", "10×"]), ("Weather sealed", ["yes", "no"]), ("Weight", (120, 820, 20, "g"))]},
    "furniture": {"shape": "chair", "variants": "color", "specs": [
        ("Width", (40, 220, 5, "cm")), ("Material", ["solid oak", "powder-coated steel", "rattan", "beech veneer", "bamboo"]), ("Weight capacity", (90, 300, 10, "kg")),
        ("Assembly", ["required, about 20 min", "required, about 45 min", "none"]), ("Outdoor use", ["yes", "no"])]},
    "lamp": {"shape": "lamp", "variants": "color", "specs": [
        ("Brightness", (300, 2400, 100, "lumens")), ("Colour temperature", ["2700 K warm", "2700–6500 K adjustable", "4000 K neutral"]), ("Dimmable", ["yes", "no"]),
        ("Power", ["plug-in", "rechargeable", "solar"]), ("Height", (25, 180, 5, "cm"))]},
    "textile": {"shape": "bedding", "variants": "color+bed", "specs": [
        ("Material", ["percale cotton", "sateen cotton", "linen", "bamboo lyocell", "microfibre"]), ("Thread count", (200, 800, 100, "")), ("Care", ["machine wash warm", "machine wash cold"]),
        ("Certified", ["OEKO-TEX style tested", "none"])]},
    "book": {"shape": "book", "variants": "format", "specs": [
        ("Pages", (120, 780, 4, "")), ("Genre", []), ("Author", []), ("Publisher", ["Larkspur House", "Quillon Press", "Bellwether & Moss", "Saltmarsh Books", "Copperleaf"]),
        ("Published", (2015, 2026, 1, "")), ("Reading age", ["adult", "young adult", "8–12", "4–8"])]},
    "toy": {"shape": "toy", "variants": "none", "specs": [
        ("Age", ["3+", "5+", "6+", "8+", "10+", "12+"]), ("Pieces", (12, 1800, 4, "")), ("Batteries", ["not needed", "2× AA included", "rechargeable, USB-C"]), ("Material", ["FSC wood", "ABS plastic", "plush", "recycled plastic"])]},
    "game": {"shape": "boardgame", "variants": "none", "specs": [
        ("Players", ["1–4", "2–4", "2–6", "3–8", "2"]), ("Play time", (15, 120, 15, "min")), ("Age", ["6+", "8+", "10+", "14+"]), ("Type", ["strategy", "party", "co-operative", "family", "puzzle"])]},
    "fitness": {"shape": "dumbbell", "variants": "color", "specs": [
        ("Weight", (1, 40, 1, "kg")), ("Material", ["cast iron, rubber coated", "neoprene", "steel", "TPE foam"]), ("Max user weight", (100, 180, 10, "kg")), ("Foldable", ["yes", "no"])]},
    "ball": {"shape": "ball", "variants": "color", "specs": [
        ("Size", ["3", "4", "5", "official", "junior"]), ("Cover", ["synthetic leather", "rubber", "PU"]), ("Use", ["indoor", "outdoor", "indoor and outdoor"])]},
    "beauty": {"shape": "jar", "variants": "shade", "specs": [
        ("Volume", (15, 500, 5, "ml")), ("Skin type", ["all", "dry", "oily", "sensitive", "combination"]), ("Fragrance-free", ["yes", "no"]),
        ("Key ingredients", ["hyaluronic acid", "niacinamide", "shea butter", "vitamin C", "ceramides", "oat extract"]), ("Cruelty-free", ["yes"])]},
    "tool": {"shape": "drill", "variants": "none", "specs": [
        ("Power", ["corded 240 W", "18 V cordless", "12 V cordless", "manual"]), ("Torque", (10, 90, 5, "Nm")), ("Speed", (400, 2200, 100, "rpm")), ("Weight", (0.4, 3.2, 0.1, "kg")),
        ("Battery included", ["yes, 2.0 Ah", "yes, 4.0 Ah", "no (tool only)", "n/a"])]},
    "garden": {"shape": "planter", "variants": "color", "specs": [
        ("Material", ["glazed ceramic", "recycled plastic", "galvanised steel", "terracotta", "cedar"]), ("Size", (15, 90, 5, "cm")), ("Drainage", ["yes", "no"]), ("Frost resistant", ["yes", "no"])]},
    "pet": {"shape": "petbowl", "variants": "color+pet", "specs": [
        ("For", ["dogs", "cats", "dogs and cats", "small pets"]), ("Material", ["stainless steel", "recycled polyester", "natural rubber", "cotton rope"]), ("Machine washable", ["yes", "no"])]},
    "office": {"shape": "notebook", "variants": "color", "specs": [
        ("Pack of", (1, 24, 1, "")), ("Paper", ["80 gsm", "100 gsm", "120 gsm"]), ("Ruling", ["lined", "dotted", "grid", "blank"]), ("Size", ["A5", "A4", "pocket"])]},
    "baby": {"shape": "stroller", "variants": "color", "specs": [
        ("Age", ["newborn+", "6 months+", "0–4 years"]), ("Weight limit", (9, 25, 1, "kg")), ("Folded size", ["compact", "standard"]), ("Material", ["recycled polyester", "organic cotton", "aluminium frame"])]},
    "auto": {"shape": "auto", "variants": "none", "specs": [
        ("Fits", ["most cars", "most cars and SUVs", "universal"]), ("Power", ["12 V socket", "USB-C", "battery", "none"]), ("Material", ["ABS plastic", "silicone", "steel", "microfibre"])]},
    "luggage": {"shape": "suitcase", "variants": "color", "specs": [
        ("Volume", (30, 110, 5, "L")), ("Wheels", ["4 spinner", "2 inline", "none"]), ("Weight", (1.8, 5.2, 0.1, "kg")), ("Cabin size", ["yes", "no"]), ("Lock", ["built-in combination", "none"])]},
    "instrument": {"shape": "guitar", "variants": "color", "specs": [
        ("Body", ["spruce top", "mahogany", "basswood", "maple"]), ("Strings or keys", ["6 strings", "4 strings", "61 keys", "88 keys", "25 keys"]), ("Includes", ["gig bag", "stand", "nothing extra", "headphones"])]},
    "health": {"shape": "pillbox", "variants": "none", "specs": [
        ("Count", (30, 180, 30, "")), ("Form", ["device", "kit", "band", "pack"]), ("Rechargeable", ["yes", "no", "n/a"])]},
    "jewelry": {"shape": "ring", "variants": "color", "specs": [
        ("Metal", ["sterling silver", "gold-plated brass", "stainless steel", "titanium"]), ("Stone", ["none", "cubic zirconia", "glass", "freshwater pearl"]), ("Length", (16, 60, 2, "cm"))]},
    "kitchenware": {"shape": "mug", "variants": "color", "specs": [
        ("Capacity", (250, 900, 50, "ml")), ("Material", ["stoneware", "porcelain", "borosilicate glass", "stainless steel", "bamboo"]), ("Dishwasher safe", ["yes", "no"]), ("Set of", (1, 8, 1, ""))]},
    "storage": {"shape": "box", "variants": "color", "specs": [
        ("Capacity", (2, 80, 2, "L")), ("Material", ["recycled plastic", "woven seagrass", "felt", "steel"]), ("Stackable", ["yes", "no"]), ("Lid", ["yes", "no"])]},
}

# department -> [(category, kind, nouns, (price lo, price hi), interests, audience)]
# audience: men, women, kids, baby, unisex, home. interests are the words a gift request is matched on.
DEPARTMENTS = {
    "Outdoors & Camping": [
        ("Hiking Backpacks", "pack", ["Hiking Daypack", "Trail Pack", "Trekking Backpack", "Summit Pack"], (35, 260), ["hiking", "camping", "travel", "outdoors"], "unisex"),
        ("Tents", "tent", ["Backpacking Tent", "Dome Tent", "Family Tent", "Ultralight Tent"], (70, 640), ["camping", "hiking", "outdoors"], "unisex"),
        ("Sleeping Bags", "sleep", ["Sleeping Bag", "Camp Quilt", "Mummy Bag"], (40, 420), ["camping", "hiking", "outdoors"], "unisex"),
        ("Water Bottles", "bottle", ["Insulated Bottle", "Trail Bottle", "Water Bottle", "Hydration Flask"], (12, 55), ["hiking", "fitness", "camping", "outdoors", "running"], "unisex"),
        ("Camp Kitchen", "cookware", ["Camp Pot", "Backpacking Stove Pot", "Camp Skillet"], (18, 140), ["camping", "cooking", "outdoors"], "unisex"),
        ("Headlamps & Lanterns", "lamp", ["Headlamp", "Camp Lantern", "Trail Light"], (14, 95), ["camping", "hiking", "running", "outdoors"], "unisex"),
        ("Trekking Poles & Gear", "tool", ["Trekking Poles", "Multi-tool", "Camp Axe"], (20, 160), ["hiking", "camping", "outdoors"], "unisex"),
        ("Hiking Boots", "shoe", ["Hiking Boot", "Trail Boot", "Mid Hiker", "Backpacking Boot"], (60, 260), ["hiking", "outdoors", "camping"], "unisex"),
        ("Trail Running Shoes", "shoe", ["Trail Runner", "Trail Running Shoe"], (55, 190), ["running", "hiking", "fitness", "outdoors"], "unisex"),
        ("Rain Jackets", "outer", ["Rain Jacket", "Waterproof Shell", "Packable Rain Shell"], (45, 330), ["hiking", "outdoors", "travel", "camping"], "unisex"),
        ("Insulated Jackets", "outer", ["Puffer Jacket", "Down Jacket", "Insulated Vest"], (60, 380), ["hiking", "outdoors", "skiing", "travel"], "unisex"),
        ("Hiking Pants", "bottom", ["Hiking Pant", "Convertible Trail Pant", "Hiking Short"], (30, 120), ["hiking", "outdoors", "camping"], "unisex"),
        ("Base Layers", "top", ["Base Layer Top", "Merino Crew", "Thermal Long Sleeve"], (25, 110), ["hiking", "skiing", "outdoors", "running"], "unisex"),
        ("Binoculars & Optics", "camera", ["Binoculars", "Compact Binoculars", "Spotting Scope"], (40, 520), ["birdwatching", "hiking", "outdoors", "travel"], "unisex"),
    ],
    "Electronics": [
        ("Smartphones", "phone", ["Smartphone", "Phone"], (180, 1150), ["tech", "photography"], "unisex"),
        ("Tablets", "tablet", ["Tablet", "Drawing Tablet", "E-reader Tablet"], (120, 980), ["tech", "reading", "art"], "unisex"),
        ("Laptops", "laptop", ["Laptop", "Ultrabook", "Creator Laptop", "Gaming Laptop"], (420, 2400), ["tech", "gaming", "work"], "unisex"),
        ("Headphones", "audio", ["Over-Ear Headphones", "Wireless Earbuds", "Sport Earbuds", "Studio Headphones"], (25, 420), ["music", "tech", "fitness", "travel", "running"], "unisex"),
        ("Bluetooth Speakers", "speaker", ["Portable Speaker", "Outdoor Speaker", "Bookshelf Speaker"], (25, 380), ["music", "outdoors", "tech", "camping"], "unisex"),
        ("Smartwatches & Fitness Trackers", "wearable", ["GPS Watch", "Fitness Tracker", "Smartwatch", "Outdoor Watch"], (40, 650), ["fitness", "running", "hiking", "tech"], "unisex"),
        ("Monitors & TVs", "screen", ["Monitor", "Gaming Monitor", "Smart TV", "Portable Monitor"], (110, 1800), ["tech", "gaming", "work", "movies"], "home"),
        ("Cameras", "camera", ["Mirrorless Camera", "Action Camera", "Compact Camera", "Instant Camera"], (90, 1900), ["photography", "travel", "tech", "outdoors"], "unisex"),
        ("Chargers & Power Banks", "auto", ["Power Bank", "Wall Charger", "Solar Charger", "Charging Dock"], (12, 140), ["tech", "travel", "camping"], "unisex"),
        ("Gaming Accessories", "audio", ["Gaming Headset", "Controller Headset"], (25, 260), ["gaming", "tech"], "unisex"),
    ],
    "Home & Kitchen": [
        ("Cookware", "cookware", ["Frying Pan", "Saucepan", "Skillet", "Wok", "Dutch Oven"], (20, 320), ["cooking", "home"], "home"),
        ("Small Appliances", "appliance", ["Air Fryer", "Blender", "Coffee Maker", "Toaster", "Rice Cooker", "Electric Kettle", "Stand Mixer"], (25, 520), ["cooking", "coffee", "baking", "home"], "home"),
        ("Mugs & Drinkware", "kitchenware", ["Coffee Mug", "Travel Mug", "Tea Cup Set", "Glass Tumbler Set"], (8, 65), ["coffee", "tea", "home"], "home"),
        ("Bakeware", "cookware", ["Baking Sheet", "Cake Pan", "Loaf Tin", "Muffin Tray"], (10, 75), ["baking", "cooking"], "home"),
        ("Kitchen Storage", "storage", ["Food Storage Set", "Pantry Canister", "Spice Rack"], (12, 90), ["home", "cooking", "organizing"], "home"),
        ("Bedding", "textile", ["Sheet Set", "Duvet Cover", "Quilt", "Pillowcase Pair"], (25, 290), ["home", "sleep"], "home"),
        ("Lighting", "lamp", ["Table Lamp", "Floor Lamp", "Desk Lamp", "String Lights"], (15, 340), ["home", "reading", "work"], "home"),
        ("Furniture", "furniture", ["Side Table", "Bookshelf", "Lounge Chair", "Desk", "Bench"], (45, 1200), ["home", "work", "reading"], "home"),
        ("Home Storage", "storage", ["Storage Basket", "Closet Organizer", "Storage Bin Set"], (10, 120), ["home", "organizing"], "home"),
        ("Bath Towels", "textile", ["Bath Towel Set", "Bath Sheet", "Hand Towel Pair"], (15, 140), ["home"], "home"),
    ],
    "Men's Clothing": [
        ("Men's T-Shirts", "top", ["Crew Tee", "Pocket T-Shirt", "Performance Tee"], (12, 55), ["fashion", "fitness", "everyday"], "men"),
        ("Men's Shirts", "top", ["Oxford Shirt", "Flannel Shirt", "Linen Shirt", "Overshirt"], (25, 120), ["fashion", "work", "everyday"], "men"),
        ("Men's Sweaters & Hoodies", "top", ["Hoodie", "Crewneck Sweater", "Quarter-Zip Pullover", "Cardigan"], (30, 160), ["fashion", "everyday", "outdoors"], "men"),
        ("Men's Pants & Jeans", "bottom", ["Chino", "Slim Jean", "Work Pant", "Jogger"], (30, 140), ["fashion", "work", "everyday"], "men"),
        ("Men's Jackets", "outer", ["Field Jacket", "Bomber Jacket", "Softshell Jacket", "Parka"], (60, 360), ["fashion", "outdoors", "travel"], "men"),
        ("Men's Activewear", "top", ["Training Tee", "Running Singlet", "Gym Short"], (18, 80), ["fitness", "running", "gym"], "men"),
    ],
    "Women's Clothing": [
        ("Women's Tops", "top", ["Linen Blouse", "Relaxed Tee", "Wrap Top", "Tunic"], (15, 95), ["fashion", "everyday", "work"], "women"),
        ("Women's Sweaters", "top", ["Cable Knit Sweater", "Cardigan", "Turtleneck", "Hoodie"], (30, 170), ["fashion", "everyday"], "women"),
        ("Women's Dresses", "top", ["Midi Dress", "Shirt Dress", "Knit Dress", "Wrap Dress"], (35, 190), ["fashion", "everyday", "work"], "women"),
        ("Women's Pants & Leggings", "bottom", ["High-Rise Legging", "Wide-Leg Trouser", "Straight Jean", "Jogger"], (25, 130), ["fashion", "fitness", "yoga", "everyday"], "women"),
        ("Women's Jackets", "outer", ["Trench Coat", "Quilted Jacket", "Rain Parka", "Fleece Jacket"], (55, 380), ["fashion", "outdoors", "travel"], "women"),
        ("Women's Activewear", "top", ["Sports Bra", "Training Tank", "Running Jacket", "Yoga Top"], (20, 110), ["fitness", "yoga", "running", "gym"], "women"),
    ],
    "Shoes": [
        ("Men's Sneakers", "shoe", ["Everyday Sneaker", "Court Sneaker", "Canvas Sneaker"], (40, 170), ["fashion", "everyday", "walking"], "men"),
        ("Women's Sneakers", "shoe", ["Everyday Sneaker", "Platform Sneaker", "Knit Sneaker"], (40, 170), ["fashion", "everyday", "walking"], "women"),
        ("Running Shoes", "shoe", ["Road Running Shoe", "Cushioned Runner", "Racing Flat"], (60, 220), ["running", "fitness"], "unisex"),
        ("Boots", "shoe", ["Chelsea Boot", "Winter Boot", "Work Boot", "Rain Boot"], (55, 260), ["fashion", "outdoors", "work"], "unisex"),
        ("Sandals & Slippers", "shoe", ["Sport Sandal", "Slide", "House Slipper"], (15, 110), ["everyday", "travel", "outdoors"], "unisex"),
        ("Kids' Shoes", "shoe", ["Kids' Sneaker", "Kids' Rain Boot", "Kids' Sandal"], (20, 75), ["kids", "everyday"], "kids"),
    ],
    "Sports & Fitness": [
        ("Weights & Strength", "fitness", ["Dumbbell Pair", "Kettlebell", "Adjustable Dumbbell", "Weight Plate"], (15, 420), ["fitness", "gym"], "unisex"),
        ("Yoga & Pilates", "fitness", ["Yoga Mat", "Yoga Block Set", "Pilates Ring", "Foam Roller"], (12, 120), ["yoga", "fitness"], "unisex"),
        ("Cardio Machines", "fitness", ["Folding Treadmill", "Exercise Bike", "Rowing Machine", "Mini Stepper"], (120, 1500), ["fitness", "gym"], "home"),
        ("Team Sports", "ball", ["Soccer Ball", "Basketball", "Volleyball", "Rugby Ball"], (12, 70), ["sports", "kids", "outdoors"], "unisex"),
        ("Cycling", "pack", ["Bike Saddle Bag", "Handlebar Bag", "Bike Commuter Pannier"], (18, 160), ["cycling", "outdoors", "travel"], "unisex"),
        ("Racket Sports", "ball", ["Tennis Ball Pack", "Pickleball Set", "Badminton Set", "Padel Ball Pack"], (8, 140), ["sports", "outdoors"], "unisex"),
        ("Swimming", "bottle", ["Swim Bottle", "Pool Bottle"], (10, 40), ["swimming", "fitness"], "unisex"),
        ("Climbing", "pack", ["Chalk Bag", "Crash Pad", "Rope Bag"], (15, 280), ["climbing", "outdoors", "fitness"], "unisex"),
    ],
    "Toys & Games": [
        ("Building Sets", "toy", ["Building Set", "Brick Kit", "Marble Run", "Construction Kit"], (15, 260), ["kids", "building", "stem"], "kids"),
        ("Board Games", "game", ["Board Game", "Strategy Game", "Card Game", "Party Game"], (12, 90), ["games", "family", "party"], "unisex"),
        ("Puzzles", "game", ["Jigsaw Puzzle", "3D Puzzle", "Logic Puzzle"], (10, 60), ["puzzles", "family", "games"], "unisex"),
        ("Plush & Dolls", "toy", ["Plush Bear", "Plush Fox", "Rag Doll", "Doll House"], (10, 160), ["kids"], "kids"),
        ("STEM Toys", "toy", ["Coding Robot", "Science Kit", "Circuit Kit", "Telescope Kit"], (20, 220), ["kids", "stem", "tech"], "kids"),
        ("Outdoor Play", "toy", ["Kite", "Water Blaster", "Balance Bike", "Scooter"], (15, 220), ["kids", "outdoors"], "kids"),
        ("Arts & Crafts", "toy", ["Paint Set", "Craft Kit", "Clay Studio", "Bead Kit"], (10, 80), ["kids", "art", "crafts"], "kids"),
    ],
    "Books": [
        ("Fiction", "book", ["Novel"], (8, 32), ["reading", "books"], "unisex"),
        ("Mystery & Thriller", "book", ["Mystery Novel", "Thriller"], (8, 30), ["reading", "books"], "unisex"),
        ("Science Fiction & Fantasy", "book", ["Novel", "Saga Volume"], (8, 34), ["reading", "books", "scifi"], "unisex"),
        ("Cookbooks", "book", ["Cookbook"], (14, 45), ["cooking", "baking", "reading", "books"], "unisex"),
        ("Travel & Outdoors Books", "book", ["Trail Guide", "Travel Guide", "Field Guide"], (10, 38), ["hiking", "travel", "reading", "books", "outdoors", "birdwatching"], "unisex"),
        ("Children's Books", "book", ["Picture Book", "Chapter Book"], (6, 22), ["kids", "reading", "books"], "kids"),
        ("Biography & History", "book", ["Biography", "History"], (10, 36), ["reading", "books", "history"], "unisex"),
        ("Self-Help & Business", "book", ["Guide", "Workbook"], (10, 32), ["reading", "books", "work"], "unisex"),
    ],
    "Beauty & Personal Care": [
        ("Skincare", "beauty", ["Daily Moisturiser", "Gel Cleanser", "Serum", "Night Cream", "Sunscreen SPF 50"], (8, 85), ["beauty", "skincare", "self-care"], "unisex"),
        ("Hair Care", "beauty", ["Shampoo", "Conditioner", "Hair Mask", "Styling Cream"], (7, 48), ["beauty", "self-care"], "unisex"),
        ("Bath & Body", "beauty", ["Body Wash", "Body Lotion", "Bath Salts", "Hand Cream"], (6, 45), ["self-care", "beauty", "home"], "unisex"),
        ("Makeup", "beauty", ["Tinted Balm", "Mascara", "Cream Blush", "Brow Gel"], (8, 42), ["beauty", "makeup"], "women"),
        ("Shaving & Grooming", "beauty", ["Shave Cream", "Beard Oil", "Aftershave Balm", "Grooming Kit"], (8, 90), ["grooming", "self-care"], "men"),
        ("Fragrance", "beauty", ["Eau de Parfum", "Cologne", "Solid Perfume"], (18, 140), ["fragrance", "self-care"], "unisex"),
    ],
    "Garden & Tools": [
        ("Power Tools", "tool", ["Cordless Drill", "Impact Driver", "Jigsaw", "Orbital Sander", "Circular Saw"], (35, 380), ["diy", "woodworking", "home"], "home"),
        ("Hand Tools", "tool", ["Hammer", "Screwdriver Set", "Wrench Set", "Tool Kit"], (10, 160), ["diy", "home", "woodworking"], "home"),
        ("Planters & Pots", "garden", ["Planter", "Plant Pot Set", "Raised Bed", "Hanging Planter"], (10, 240), ["gardening", "home", "plants"], "home"),
        ("Garden Tools", "tool", ["Pruning Shears", "Garden Trowel Set", "Hose Reel", "Leaf Rake"], (10, 140), ["gardening", "outdoors"], "home"),
        ("Grills & Outdoor Cooking", "cookware", ["Charcoal Grill", "Grill Pan", "Pizza Oven Stone", "Griddle"], (25, 650), ["grilling", "cooking", "outdoors"], "home"),
        ("Patio Furniture", "furniture", ["Patio Chair", "Bistro Set", "Outdoor Lounger", "Hammock"], (45, 980), ["outdoors", "home", "gardening"], "home"),
    ],
    "Pet Supplies": [
        ("Dog Supplies", "pet", ["Dog Bed", "Dog Leash", "Chew Toy", "Dog Bowl", "Dog Harness"], (8, 160), ["pets", "dogs"], "unisex"),
        ("Cat Supplies", "pet", ["Cat Tree", "Cat Bed", "Scratching Post", "Cat Toy Set", "Cat Bowl"], (6, 220), ["pets", "cats"], "unisex"),
        ("Small Pet & Aquarium", "pet", ["Hamster Habitat", "Aquarium Starter Kit", "Bird Perch"], (10, 240), ["pets"], "unisex"),
    ],
    "Office & School": [
        ("Notebooks & Paper", "office", ["Notebook", "Planner", "Sketchbook", "Sticky Note Set"], (4, 40), ["writing", "work", "school", "art"], "unisex"),
        ("Pens & Writing", "office", ["Gel Pen Set", "Fountain Pen", "Marker Set", "Pencil Set"], (5, 120), ["writing", "art", "school", "work"], "unisex"),
        ("Desk Accessories", "storage", ["Desk Organizer", "Monitor Stand", "Document Tray", "Cable Box"], (10, 90), ["work", "organizing"], "unisex"),
        ("Backpacks & Bags", "pack", ["School Backpack", "Laptop Backpack", "Messenger Bag", "Tote"], (20, 180), ["school", "work", "travel"], "unisex"),
        ("Office Chairs", "furniture", ["Ergonomic Chair", "Task Chair", "Kneeling Chair"], (90, 780), ["work", "home"], "home"),
    ],
    "Baby": [
        ("Strollers & Car Seats", "baby", ["Compact Stroller", "Jogging Stroller", "Infant Car Seat", "Convertible Car Seat"], (90, 780), ["baby", "parents"], "baby"),
        ("Nursery", "textile", ["Crib Sheet Set", "Swaddle Blanket", "Baby Quilt"], (12, 90), ["baby", "parents"], "baby"),
        ("Feeding", "bottle", ["Baby Bottle Set", "Sippy Cup", "Snack Cup"], (8, 60), ["baby", "parents"], "baby"),
        ("Baby Toys", "toy", ["Soft Rattle", "Stacking Rings", "Activity Gym", "Teether Set"], (8, 120), ["baby"], "baby"),
    ],
    "Automotive": [
        ("Car Accessories", "auto", ["Phone Mount", "Seat Organizer", "Trunk Organizer", "Sunshade"], (8, 90), ["cars", "travel"], "unisex"),
        ("Car Care", "auto", ["Microfibre Wash Kit", "Tyre Inflator", "Jump Starter", "Detailing Kit"], (10, 160), ["cars", "diy"], "unisex"),
    ],
    "Travel & Luggage": [
        ("Suitcases", "luggage", ["Carry-On Spinner", "Checked Spinner", "Hardside Suitcase", "Softside Suitcase"], (60, 480), ["travel"], "unisex"),
        ("Travel Bags", "pack", ["Duffel Bag", "Weekender", "Travel Backpack", "Packing Cube Set"], (20, 240), ["travel", "fitness", "outdoors"], "unisex"),
        ("Travel Accessories", "storage", ["Toiletry Bag", "Travel Pillow", "Luggage Tag Set", "Passport Wallet"], (8, 60), ["travel"], "unisex"),
    ],
    "Musical Instruments": [
        ("Guitars & Basses", "instrument", ["Acoustic Guitar", "Electric Guitar", "Bass Guitar", "Ukulele"], (60, 1400), ["music"], "unisex"),
        ("Keyboards & Pianos", "instrument", ["Digital Piano", "Keyboard", "MIDI Controller"], (70, 1600), ["music", "tech"], "unisex"),
        ("Instrument Accessories", "instrument", ["Guitar Strap", "Tuner", "Instrument Stand", "String Set"], (6, 90), ["music"], "unisex"),
    ],
    "Health & Wellness": [
        ("Wellness Devices", "health", ["Massage Gun", "Heating Pad", "Humidifier", "Sunrise Alarm"], (20, 240), ["self-care", "fitness", "sleep", "home"], "unisex"),
        ("First Aid", "health", ["First Aid Kit", "Trail First Aid Kit", "Blister Kit"], (8, 75), ["hiking", "camping", "travel", "outdoors"], "unisex"),
        ("Sleep", "textile", ["Sleep Mask", "Weighted Blanket", "Cooling Pillow"], (10, 220), ["sleep", "self-care", "travel"], "unisex"),
    ],
    "Jewelry & Watches": [
        ("Necklaces", "jewelry", ["Pendant Necklace", "Chain Necklace", "Charm Necklace"], (15, 260), ["fashion", "jewelry"], "women"),
        ("Rings & Earrings", "jewelry", ["Stacking Ring", "Hoop Earrings", "Stud Earrings"], (12, 220), ["fashion", "jewelry"], "women"),
        ("Men's Accessories", "jewelry", ["Leather Bracelet", "Cufflinks", "Chain Bracelet"], (15, 160), ["fashion", "jewelry"], "men"),
        ("Analog Watches", "wearable", ["Field Watch", "Dive Watch", "Dress Watch"], (45, 620), ["fashion", "outdoors"], "unisex"),
    ],
}

COLORS = {
    "Black": "#1f2328", "Charcoal": "#3c4148", "Slate Grey": "#6b7480", "White": "#f2f2ee", "Sand": "#d9c6a5", "Khaki": "#a89a6c",
    "Forest Green": "#2f5d43", "Olive": "#6b7537", "Sage": "#9fb79a", "Navy": "#1f3557", "Ocean Blue": "#2f6f9f", "Sky Blue": "#86b8de",
    "Teal": "#1f7a78", "Burgundy": "#7a2534", "Brick Red": "#b0442f", "Coral": "#e8735d", "Rust": "#a95a2b", "Mustard": "#d3a128",
    "Plum": "#5d3a64", "Lavender": "#b5a3d6", "Blush": "#e8b7b0", "Brown": "#6b4a32", "Cream": "#efe6d2", "Red": "#c63b33",
}
APPAREL_SIZES = ["XS", "S", "M", "L", "XL", "XXL"]
SHOE_SIZES = ["6", "6.5", "7", "7.5", "8", "8.5", "9", "9.5", "10", "10.5", "11", "12", "13"]
KIDS_SHOE_SIZES = ["10C", "11C", "12C", "13C", "1Y", "2Y", "3Y", "4Y"]
BED_SIZES = ["Twin", "Full", "Queen", "King"]
STORAGE = ["128 GB", "256 GB", "512 GB", "1 TB"]
SCREEN_SIZES = ["24 in", "27 in", "32 in", "43 in", "55 in", "65 in"]
PET_SIZES = ["Small", "Medium", "Large"]
FORMATS = ["Paperback", "Hardcover", "Audiobook CD"]
SHADES = ["Fair", "Light", "Medium", "Tan", "Deep"]

# Product lines (the second word of a title) and brand-name syllables. Combined, then checked against REAL below.
LINES = ["Ridgeline", "Driftwood", "Harbor", "Cinder", "Meadow", "Juniper", "Fjord", "Kestrel", "Tamarack", "Basalt", "Lumen", "Halcyon",
         "Saltbush", "Quarry", "Tern", "Willet", "Larch", "Sorrel", "Mistral", "Cobalt", "Ember", "Aspen", "Granite", "Thistle",
         "Wren", "Marten", "Sable", "Hollow", "Tundra", "Cove", "Pinion", "Brook", "Lark", "Heron", "Pika", "Moraine", "Scree", "Talus",
         "Bramble", "Clover", "Nimbus", "Zephyr", "Orbit", "Pulse", "Vista", "Echo", "Nova", "Atlas", "Arc", "Prism", "Haven", "Loft"]
BRAND_A = ["Fern", "Copper", "Moss", "Tide", "Stone", "Lark", "Hazel", "Birch", "Pebble", "Thorn", "Wick", "Quill", "Bay", "Rook",
           "Elm", "Flint", "Gale", "Holm", "Kiln", "Loam", "Marl", "Nettle", "Oak", "Pine", "Reed", "Sedge", "Tarn", "Vale", "Wold", "Yarrow"]
BRAND_B = ["hollow", "field", "wright", "mere", "stead", "worth", "combe", "ford", "brook", "gate", "ley", "wick", "haven", "crest",
           "fold", "shaw", "thwaite", "by", "ridge", "moor"]
# Real store and brand names a syllable pair could land on; a generated brand matching one is skipped.
REAL = {"stonebrook", "oakley", "pinebrook", "birchfield", "hazelwood", "copperfield", "bayford", "tideford", "elmwood", "oakridge", "pineridge",
        "stonehaven", "fernhaven", "reedfield", "bayhaven", "flintridge", "thornfield", "elmfield", "oakfield", "pinecrest", "stonecrest",
        "birchwood", "oakwood", "pinewood", "elmstead", "fernbrook", "oakhaven", "stonegate", "baygate", "pinegate", "oakgate", "rookwood"}

ADJ = ["Lightweight", "Everyday", "Packable", "Classic", "Pro", "Compact", "Essential", "Deluxe", "Trail", "Urban", "Heritage", "Eco", "Plus", ""]

# Fictional authors and genres for books
GIVEN = ["Ada", "Bram", "Cleo", "Dov", "Elin", "Faris", "Greta", "Hollis", "Ines", "Jory", "Kaia", "Lionel", "Mira", "Nils", "Odette", "Pell",
         "Quinn", "Rosalind", "Soren", "Tamsin", "Ulla", "Vesper", "Wynn", "Xavi", "Yara", "Zeb"]
FAMILY = ["Ashgrove", "Brindle", "Calloway", "Dunmore", "Everly", "Farrow", "Galloway", "Hartwell", "Ivers", "Juniper", "Kettering", "Lowry",
          "Merriweather", "Nightingale", "Oakhurst", "Pemberly", "Quarrie", "Rowntree", "Stirling", "Thackery", "Underhill", "Vance", "Whitlock"]
BOOK_WORDS = ["Lantern", "Harbour", "Winter", "Orchard", "Glass", "Tide", "Salt", "Ember", "River", "Paper", "Iron", "Quiet", "Silver",
              "Last", "Hidden", "Northern", "Borrowed", "Little", "Long", "Wild", "Hollow", "Distant", "Seventh", "Clockwork"]
BOOK_NOUNS = ["House", "Road", "Garden", "Season", "Keeper", "Map", "Letters", "Island", "Crossing", "Archive", "Promise", "Light",
              "Summer", "Signal", "Kingdom", "Station", "Machine", "Field", "Shore", "Path"]

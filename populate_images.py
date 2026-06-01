
import requests
import os
import glob

BASE_URL = "http://localhost:8000/api"
ADMIN_USER = "Иван"
ADMIN_PWD = "admin123"

def populate_images():
    # 1. Login
    print(f"Logging in as {ADMIN_USER}...")
    try:
        resp = requests.post(f"{BASE_URL}/auth/login/", json={
            "username": ADMIN_USER,
            "password": ADMIN_PWD
        })
        resp.raise_for_status()
        token = resp.json().get('access')
        headers = {"Authorization": f"Bearer {token}"}
    except Exception as e:
        print(f"Login failed: {e}")
        return

    # 2. Get Halls
    print("Fetching halls...")
    resp = requests.get(f"{BASE_URL}/halls/", headers=headers)
    data = resp.json()
    halls = data.get('results', [])
    
    if not halls:
        print("No halls found to update.")
        return

    # 3. Find image files in the current container (frontend assets were built into src/assets in project root)
    # But since we are inside the backend container, we need to find where the images are.
    # Actually, the project root was copied to /app/ in backend.
    asset_dir = "/app/frontend/src/assets"
    image_files = [
        "hall-interior-custom.jpg",
        "portfolio-editorial-portrait.jpg",
        "portfolio-family-session.jpg",
        "portfolio-wedding-session.jpg",
        "exposition.jpg"
    ]
    
    # 4. Upload images to halls
    for i, hall in enumerate(halls):
        hall_id = hall['id']
        # Rotate through images
        img_filename = image_files[i % len(image_files)]
        img_path = os.path.join(asset_dir, img_filename)
        
        if os.path.exists(img_path):
            print(f"Uploading {img_filename} to Hall ID {hall_id} ({hall['name']})...")
            with open(img_path, 'rb') as f:
                files = {'images': (img_filename, f, 'image/jpeg')}
                upload_resp = requests.post(f"{BASE_URL}/halls/{hall_id}/images/", headers=headers, files=files)
                if upload_resp.status_code in [200, 201]:
                    print(f"Successfully updated Hall {hall_id}")
                else:
                    print(f"Failed to update Hall {hall_id}: {upload_resp.text}")
        else:
            print(f"Asset not found: {img_path}")

if __name__ == "__main__":
    populate_images()

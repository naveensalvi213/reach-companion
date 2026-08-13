import os
import requests

auth_token = "356227ab8b7e0bc125c19b9de56384901e7262e9"
ct0 = "a23739e38a42bd91c82fd849a30667f7b68cca8d81e11361670c0bce9f85a15f024352f21d5c10af1cbfaf876a38b4f6177a6e1cf0b41ba40aa17d1e76ca3eeb14bb8f2db0f8bd932c3cfe60d7bf9df7"

headers = {
    'authority': 'x.com',
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'accept-language': 'en-US,en;q=0.9',
    'cookie': f'auth_token={auth_token}; ct0={ct0}',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
}

print("Fetching x.com/home...")
response = requests.get('https://x.com/home', headers=headers, allow_redirects=True)
print(f"Status Code: {response.status_code}")
print(f"Final URL: {response.url}")

# Save output
with open('twitter-response.html', 'w', encoding='utf-8') as f:
    f.write(response.text)

print(f"Saved response to twitter-response.html (Length: {len(response.text)})")

if "ondemand" in response.text:
    print("Found 'ondemand' in response!")
else:
    print("Could NOT find 'ondemand' in response.")

if "login" in response.url.lower():
    print("WARNING: Redirected to login page! Token is EXPIRED or INVALID.")

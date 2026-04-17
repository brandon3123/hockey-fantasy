"""
Quick test script to check what Playwright sees on Hockey-Reference.
"""

import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)  # Show browser for debugging
        page = await browser.new_page()

        print("Loading Hockey-Reference...")
        await page.goto('https://www.hockey-reference.com/leagues/NHL_2026.html')

        print("Waiting 5 seconds for JS to load...")
        await asyncio.sleep(5)

        # Try to find any tables
        tables = await page.query_selector_all('table')
        print(f"Found {len(tables)} tables")

        for i, table in enumerate(tables[:3]):
            id_attr = await table.get_attribute('id')
            print(f"  Table {i+1}: id={id_attr}")

        # Save screenshot
        await page.screenshot(path='hockeyref_screenshot.png')
        print("Saved screenshot to hockeyref_screenshot.png")

        input("Press Enter to close...")
        await browser.close()

asyncio.run(main())

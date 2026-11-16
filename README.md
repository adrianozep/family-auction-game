# Family Auction Night 🔨

A Kahoot-style live auction for up to 100 players. Players scan a QR code, choose a nickname of up to 10 characters, and bid from their phones. The host runs everything from one control screen.

## Setup: NO installs needed (recommended)
Everything happens in your web browser. **You do NOT need to install Node.js or anything else.** Render's free plan runs the game on its computers, and phones can join from any Wi-Fi or cell data.

### Step 1: Unzip
Double-click **auction-night.zip** (on Windows: right-click, then **Extract All**). Open the **auction-night** folder. Inside you should see exactly this:

```
home.html
host.html
package-lock.json
package.json
play.html
README.md
render.yaml
server.js
sfx.js
tv.html
```

### Step 2: Upload to GitHub
1. Sign up or log in at **github.com**.
2. Click **New** (or **+**, then **New repository**). Name it `auction-night` and click **Create repository**.
3. Click the link **"uploading an existing file"**.
4. Go back to the open **auction-night** folder. Select **everything inside it** (Ctrl+A on Windows, Cmd+A on Mac), all 10 files, and drag them onto the GitHub page.
   - Drag what's **inside** the folder, **not** the auction-night folder itself.
5. Wait until every file appears in the list, then click **Commit changes**.
6. **Check:** the first page of your GitHub repository should show all 10 files, including `server.js`, `play.html` and `host.html`. If you instead see a single folder called `auction-night`, see "Fixes" below.

### Step 3: Deploy on Render
1. Go to **render.com** and choose **Sign in with GitHub**.
2. Click **+ New**, then **Web Service**, and pick your **auction-night** repository.
3. Make sure **Instance Type** is **Free**, then click **Deploy Web Service**.
4. Wait 2 to 5 minutes until it says **Live**. You don't need to set a host key in Render.

### Step 4: Your one link
1. In Render, click your service. Your link is near the top, under the name, and ends in **.onrender.com**.
   - **Copy it exactly as shown, including the letters and numbers before .onrender.com** (for example `auction-night-x7k2.onrender.com`). Without them you reach a different site.
2. Open that link. You'll see two big buttons:
   - **📺 TV screen:** open this on the TV. Click **⛶ Full screen** at the top right to hide your browser tabs (or press **F**).
   - **🎛️ Host controls:** for you. The first time, create your host key (tap **👁 Show** to see what you type). Your browser remembers it after that.
3. **Players** scan the QR code on the TV. No app needed, and Wi-Fi or cell data both work.

### New QR code every game
- Every new game gets its own game code and QR code. Old QR codes and links stop working for new players.
- Want a fresh code mid-game? On the host controls, click **🔄 New QR code** (next to Players). People already playing stay in.

### Final results
When you press **End game**, the TV shows a podium of whoever **won the most items**, then 2nd and 3rd. Ties go to whoever has more money left.

### Fixes
- **Your GitHub repository shows one folder called auction-night:** you can leave it. In Render, open your service, click **Settings**, find **Root Directory**, type `auction-night`, and save. Then click **Manual Deploy** and choose **Deploy latest commit**.
- **Forgot your host key:** in Render, open your service, click **Manual Deploy**, then **Restart service**. This resets the game, and you can create a new key on the host page.
- **Host page says the key is wrong on another device:** type the key you created. Tap **👁 Show** to see what you're typing.
- **Deploy failed:** in Render, open your service and click **Logs**. Send a screenshot of the red error lines to Claude.

Good to know about the free plan:
- It **goes to sleep after 15 minutes without any visitors**. Open the TV screen a couple of minutes before game night to wake it up. The first load can take up to a minute.
- Once people are playing, the traffic keeps it awake.
- Render says it may restart free apps at any time. That's rare, but a restart clears the game (players and money). If it happens, everyone rescans and you set the money again.
- Only people who can see the QR code on the TV can join, so it stays "in the room."

---

## Alternative: run it on your own laptop (requires installing Node.js)
Only use this if you'd rather not use Render. Everyone must be on your Wi-Fi.

### Setup (one time, about 5 minutes)
1. Install **Node.js** (version 18 or newer, the "LTS" download) from https://nodejs.org
2. Unzip this folder, open a terminal in it, and run:
   ```
   npm install
   ```

### Game night on your laptop
1. Connect your laptop to the **same Wi-Fi** your family's phones are using.
2. In the folder, run:
   ```
   npm start
   ```
3. The terminal prints two links:
   - **HOST link** (includes your secret key): your control panel. Keep it on your laptop.
   - **TV link** (`/tv`): the big screen for the room. Open it in a second browser window on the TV, or use the **📺 Open TV screen** button on the host panel and drag that window to the TV. Click once to turn on sound and full screen. Press **F** to toggle full screen and **M** to mute.
   - Windows: if a firewall prompt pops up, click **Allow** (Private networks).
4. Everyone scans the QR code on the host screen, types a nickname, and joins.
5. Press **Start game**, then give out money under "Everyone's money", for example "Set everyone to $500".

## The TV screen
- **Lobby:** a big QR code plus a wall of every player's name and money, which grows as people join.
- **During a round:** the item, the price, the timer, and every player's name tile with their money. Whoever locked the bid lights up **bright green**. They stay green after you raise the price, until someone else takes the new bid.
- The name tiles resize automatically to fit 1 to 100 players.
- **After a round:** a "SOLD!" flash with confetti, then a **winner screen** showing the winner, what they won, the price, and the money they have left. It stays up until you start the next round.
- **Game over:** a podium for the top 3 and final standings.
- **Sounds:** join pops, a lock-in ding, a raise whoosh, countdown beeps for the last 5 seconds, a buzzer, a triple gavel and fanfare for SOLD, and a finale for the end of the game.

## Running an auction
- In **Set up round N**, type an item name (optional) and a starting $ amount, and pick a timer: **No timer, 30 sec, 1 min, 3 min, 5 min**, or a custom time like `2:30` or `45` (seconds). Then press **Start round**. You can fill in the next round's settings while the current round is still going.
- Players see the price and a big **BID** button. The **first tap wins the lock**, and bidding closes for everyone else.
- To reopen bidding at a higher price, press **+5 / +10 / +15 / +20**, enter a custom raise, or set an exact bid. The player who locked in last keeps holding at their price until someone else bids.
- Press **SOLD** to award the item. The winner's money is deducted automatically.
- **Cancel round** ends a round with no winner.
- **Timer controls during a round:** **+30 sec**, **+1 min**, a custom amount, or **Stop timer**.
- **Final 5 seconds:** nobody can bid. Phones show "bidding is closed", the TV counts down with beeps, and phones buzz.
- **When time runs out:** the item automatically sells to whoever is holding the bid. If nobody bid, the round ends with no winner.
- Keyboard shortcuts on the host screen: keys `1` to `4` raise by 5, 10, 15 or 20, and `S` sells.

## Rules built in
- Up to 100 players. Nicknames are 10 characters max (letters, numbers and spaces; accents like é and ñ are fine) and must be unique.
- Players can't bid more money than they have.
- No bids are accepted in the final 5 seconds of a timed round.
- The current leader can't outbid themselves.
- If the host raises the price at the same moment a player taps, that tap is rejected. Nobody gets charged a price they didn't see.
- If a phone locks or refreshes, the player reconnects automatically and keeps their money.

## Host money tools
- **Set everyone to / Give all / Take from all**: changes everyone's money at once.
- **Player list**: type an amount in the small box, then press **+** to give, **−** to take, or **=** to set exactly. **✕** removes a player.
- **New game**: resets money and sold items. You can keep the same players or have everyone rejoin.

## Optional settings
- `PORT=4000 npm start`: use a different port.
- `HOST_KEY=MYKEY npm start`: pre-set the host key instead of creating it on the host page.
- `PUBLIC_URL=https://your-domain npm start`: if you host it online, for example on Render, this makes the QR code point to that address.

Note: game data lives in memory. Restarting the server starts a fresh game.

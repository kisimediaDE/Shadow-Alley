# Shadow Alley 🐾🌙

A stealth puzzle game created for the **js13kGames 2025** competition.  
**Theme: Black Cat**

---

## 🌧️ Story

You are a stray black cat wandering the rainy backstreets of the city.  
Hungry and alone, you sneak through the night in search of fish — but the alleys are guarded by lamps and watch dogs.  
Only stealth and patience will keep you safe.

The rain never ends, the lamps burn cold, and the streets are filled with danger.  
Yet hope drives you forward — every fish brings you closer to surviving another night in the **Shadow Alley**.

## 🎮 Controls

- **Arrow Keys / WASD** → Move
- **R** → Restart current level
- **M** → Toggle sound

## 🐟 Goal

Collect all the fish in each alley and reach the glowing door to progress.

## ⚡ Challenge

- Avoid the light of street lamps — once caught, there’s no way back.
- Stay out of sight from the guard dogs and their patrols.
- Use hiding spots to wait for the right moment to slip by.

## 🌟 Features

- Compact size under **13 KB zipped** (all HTML, CSS, JS inlined).
- Multiple handcrafted levels with increasing difficulty.
- Unlock system: finish a level to unlock the next.
- Rain ambience and atmospheric light effects.
- Procedural WebAudio sound effects.
- Works offline, no external assets.

## Play the Game

- 🎮 **Post-Competition Version** (recommended): [shadow-alley.kisimedia.de](https://shadow-alley.kisimedia.de)
- 🏆 **Original Competition Entry**: [js13kgames.com](https://js13kgames.com/2025/games/shadow-alley)

The post-competition version includes quality-of-life improvements based on 
user feedback, with better visibility and responsive canvas scaling.

## 📂 Repository

- `index.html` – Minified playable build for submission.
- `game.js`, `levels.js`, `style.css` – Readable source for development.
- `editor.html` – Level editor to create and test new alleys.
- `build.js` – Simple Node build script to minify and inline.
- `dist/shadow-alley.zip` – Final package for js13kGames submission.

## 📝 Level Editor

A simple level editor (`editor.html`) is included to design and test new levels.  
Users can place walls, lamps, guards, fish, and exits on a 30×20 grid.  
Levels can be exported as text or saved for integration into `levels.js`.

## 🛠️ Development

```bash
npm install
npm run build
```

This generates a minified version in `dist/index.html` and `dist/shadow-alley.zip`.

## 📜 License

MIT – feel free to learn from or remix this code.  
All art and sound are procedurally generated or original.

### Shadow Alley © 2025 by KisimediaDE

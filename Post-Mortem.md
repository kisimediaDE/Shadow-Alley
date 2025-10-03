# Shadow Alley: My First Game Jam - Post-Mortem
**js13kGames 2025 | Theme: Black Cat 🐾**

*Size: 10.06 KB → 10.27 KB*

## The Beginning
This was my first code competition ever. I’m a web developer who dabbled in game dev ~10 years ago, so jumping into js13kGames was definitely stepping out of my comfort zone. When “Black Cat” was announced as the theme, I created Shadow Alley – a stealth puzzle game where you play as a stray cat sneaking through rainy alleys, avoiding lights and guard dogs while hunting for fish.
The game has 9 levels (because a cat has 9 lives – well, at least in English folklore). The goal was simple: make it atmospheric, challenging, and frustrating in the best way. I even planned a death counter, which I cut for size constraints.

**Play it:** [shadow-alley.kisimedia.de](https://shadow-alley.kisimedia.de) | [Source Code](https://github.com/kisimediaDE/Shadow-Alley)

## What Went Well
The community feedback was incredible:
- “This was one of my favorite games - beautiful graphics and controls and very cool progression.” – Jedidiah Weller (Expert Judge)
- “Very atmospheric… the rain-effect adds much to the atmosphere.” – Multiple reviewers

People got what I was going for: the mood, the rain, the tense stealth gameplay. Mission accomplished.

## What Didn’t Go Well
**“Too small!”**

I developed on a 4K display and honestly didn’t think the size was an issue. Turns out, many players on larger monitors found it tiny. Fair enough.

**“Too dark!”**

Black cat + dark walls + dark background = invisible on some screens. What looked moody to me was just… hard to see for others.

**“Too hard!”**

Here’s the thing: the difficulty was intentional. I wanted that “one more try” frustration. But I didn’t realize how much insider knowledge I had from designing every level. What felt like “challenging” to me was “brutal” to fresh players.

## The Post-Compo Fix (v1.1.1)
I addressed the technical issues while keeping the challenge intact:

✅ Dynamic canvas scaling – Resizes with your window

✅ Better visibility – Cat has subtle shadow effects, walls are lighter

✅ Responsive UI – No more off-screen controls

❌ Difficulty unchanged – It’s still meant to be hard. That’s the game.

Still only 10.27 KB zipped.

## Want More Levels?
The game includes a level editor (`editor.html` in the repo). If you want to create your own challenging puzzles or extend the 9 lives, feel free to fork it and go wild. I’d love to see what the community comes up with!

## What I Learned
- **Test on different displays early.** What looks fine on your screen might not work for everyone.
- **Accessibility ≠ dumbing it down.** Players being able to see the game doesn’t make it easier.
- **You can’t gauge your own difficulty.** I knew every pattern by heart. Of course it felt fair.
- **Ship imperfect work.** I almost didn’t submit. The feedback I got was worth more than another week of polishing.
- **The js13kGames community is gold.** Thoughtful reviews, video playthroughs, genuine encouragement. This was the best part.

## Thank You
To Andrzej Mazur for running js13kGames, and to everyone who played Shadow Alley and left feedback. your reviews made this worth doing.

## Final Thoughts
If you’re thinking about entering js13kGames: do it. Especially if you’re nervous. Especially if you’re “not ready.”

I wasn’t ready either. That’s exactly why it mattered.

May your paths stay shadowed and your fish plentiful. 🐾

## Links:
🎮 [Play](https://shadow-alley.kisimedia.de) | [🏆 Competition Entry](https://js13kgames.com/2025/games/shadow-alley) | [💻 GitHub](https://github.com/kisimediaDE/Shadow-Alley) | [🛠️ Level Editor](https://github.com/kisimediaDE/Shadow-Alley/blob/main/editor.html)

# TRM-Live-UI Guide

[中文](guide.zh-CN.md) | English | [日本語](guide.ja.md)

## Start

Double-click `start.bat`. The window shows two addresses:

- Overlay: `http://127.0.0.1:5170/overlay`
- Control panel: `http://127.0.0.1:5170/panel`

Keep this window open while you are live.

## Set up OBS

1. Add a "Browser" source. Set the URL to the overlay address, the width to 1920, and the height to 1080.
2. Add the control panel address under "Docks → Custom Browser Docks" to edit content inside OBS.
3. Order the sources from top to bottom as follows:
   - The Live2D model (VTube Studio), covering the whole canvas
   - The overlay (this project)
   - The game or screen capture, aligned to the cut-out in the middle

## Align the center capture

Select the game or screen capture source in OBS and press Ctrl + E to open "Edit Transform". Fill in the values below (based on OBS 32):

| Section | Field | Value |
|---|---|---|
| Position | X, Y | 20, 124 |
| Position | Alignment | Top Left |
| Size | Width, Height | Leave as is; they follow the bounds |
| Bounds | Bounds Type | Cover |
| Bounds | Width, Height | 1480, 836 |
| Bounds | Bounds Alignment | Center |
| Bounds | Crop Bounds | Checked |

These values come from the x, y, w and h of the `capture` region in `config/settings.json`, with 4 extra pixels on each side. The extra pixels sit under the overlay edge and prevent a thin black line. After you change the layout, use "x − 4, y − 4, w + 8, h + 8".

"Cover" with "Crop Bounds" fills the whole area and trims the overflow, so no black bars appear. To show the full picture instead, choose "Fit". Black bars appear when the aspect ratio does not match.

If the window capture includes a title bar or border, enter the pixels to remove under "Crop" in the same window.

## Edit content

Edit the text in the control panel, then click "更新到直播" (Update) or press Ctrl + Enter. The overlay changes at once without a refresh.

Content is stored in `config/content.json`, which you can also edit directly. On first start, this file is created from `config/content.default.json`. It stays on your computer and is not committed to the repository.

## Scenes

The top of the control panel switches between four scenes. A click takes effect at once:

| Scene | Overlay |
|---|---|
| Live | The normal layout |
| Starting | Geometric tiles turning in a wave |
| Be right back | A row of small shapes hopping in turn |
| Ending | A sun slowly setting, with twinkling stars |

In the last three scenes, the top bar stays and the area below changes to a waiting screen. Edit the text of each waiting screen in the control panel. Enter a time such as 21:00 in the countdown field to show a countdown. Leave it empty to hide it.

The waiting screens keep 420 pixels free on the right for the Live2D model. Change this width with `reserve` in the matching region in `config/settings.json`. The animation colors are in `theme.palette`.

To add a scene, add an entry to `scenes`, then add a region of kind `screen` to `regions`. Use `options.scene` to link it to the scene and `options.animation` to choose the animation. To add an animation, edit `public/js/animations.js`.

## Presets

The preset area is below the scenes:

- **Save**: Enter a name and click "保存当前内容" (Save current content). A preset with the same name is replaced.
- **Load**: Choose a preset from the list and click "载入" (Load). The content fills the fields below. It appears on the overlay after you click "更新到直播" (Update).
- **Delete**: Choose a preset and click "删除" (Delete).

Presets are stored in `config/presets/`, one file per preset, so you can copy them to others. This folder also stays on your computer.

## Change the layout and colors

Edit `config/settings.json`. The overlay updates when you save.

- `theme.fonts`: fonts. `title` is for headings and `body` is for body text.
- `theme.colors`: colors
- `theme.sizes`: font sizes
- `theme.radius`: corner radius
- `ticker`: ticker speed, in pixels per second
- `regions`: the position (x, y) and size (w, h) of each region, in pixels. With `"options": { "autoHeight": true }`, the height follows the content and h is the maximum height. The notice region uses this by default.
- `server.port`: the port. Restart after you change it.

## Region kinds

| Kind | Use |
|---|---|
| `hole` | A cut-out that shows the OBS source below |
| `title` | Badge, show name and episode title |
| `status` | Status text with an optional clock |
| `notice` | Notice |
| `ticker` | Scrolling ticker |
| `screen` | Waiting screen, shown only in its scene |

To add a region kind, edit `public/js/kinds.js`.

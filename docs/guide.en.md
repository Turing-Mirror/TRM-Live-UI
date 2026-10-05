# TRM Live UI Guide

[中文](guide.zh-CN.md) | English | [日本語](guide.ja.md)

To make your own UI pack or to contribute, see the [developer guide](develop.en.md).

## Start

Install [Node.js](https://nodejs.org/) 20 or later, then double-click `start.bat`. The window shows two addresses:

- Overlay: `http://127.0.0.1:5170/overlay`
- Control panel: `http://127.0.0.1:5170/panel`

Keep this window open while you are live.

## Set up OBS

1. Add a "Browser" source. Set the URL to the overlay address, the width to 1920, and the height to 1080.
2. Open the control panel in a browser. You can also add it under "Docks → Custom Browser Docks" to use it inside OBS.
3. Order the sources from top to bottom as follows:
   - The Live2D model (VTube Studio), covering the whole canvas
   - The overlay (this program)
   - The game or screen capture, aligned to the cut-out in the middle

## Align the center capture

Select the game or screen capture source in OBS and press Ctrl + E to open "Edit Transform". Fill in the values below (based on OBS 32 and the default UI pack):

| Section | Field | Value |
|---|---|---|
| Position | X, Y | 20, 124 |
| Position | Alignment | Top Left |
| Size | Width, Height | Leave as is; they follow the bounds |
| Bounds | Bounds Type | Cover |
| Bounds | Bounding Box Width, Height | 1480, 836 |
| Bounds | Bounds Alignment | Center |
| Bounds | Crop Bounds | Checked |

These values come from the x, y, w and h of the `capture` region in the UI pack's `pack.json`, with 4 extra pixels on each side. The extra pixels sit under the overlay edge and prevent a thin black line. After a layout change, use "x − 4, y − 4, w + 8, h + 8".

"Cover" with "Crop Bounds" fills the whole area and trims the overflow, so no black bars appear. To show the full picture instead, choose "Fit". Black bars appear when the aspect ratio does not match.

If the window capture includes a title bar or border, enter the pixels to remove under "Crop" in the same window.

## Control panel

The sidebar on the left has five pages: Live, Content, Presets, UI library and Settings. Below them, every scene is listed, and a click switches to it. In a narrow window, such as an OBS dock, the sidebar collapses to a column of icons.

| Page | Use |
|---|---|
| Live | Switch scenes and watch the live preview |
| Content | Edit the text on the overlay and the waiting screens |
| Presets | Save, load and delete presets |
| UI library | Switch, import, export and delete UI packs |
| Settings | Panel language, the addresses OBS needs, and version information |

### Edit content

Edit the text on the Content page, then click "Update" or press Ctrl + Enter. A section with unpublished changes shows a small dot next to its title, and so does "Content" in the sidebar. Click "Discard changes" to return to what the overlay shows now.

### Scenes

A click takes effect at once. Alt + a number key also works. The default UI pack has four scenes:

| Scene | Overlay |
|---|---|
| Live | The normal layout |
| Starting soon | Geometric tiles turning in a wave |
| Be right back | A row of small shapes hopping in turn |
| Ending soon | A sun slowly setting, with twinkling stars |

When you switch to a waiting screen, a curtain closes from left to right, and then the text and animation appear. When you switch between waiting screens, the curtain stays closed and only the content changes, so the live content below never shows. When you switch back to Live, the curtain opens to the right.

Enter a time such as 21:00 in "Count down to" to show a countdown. Leave it empty to hide it.

### Presets

- **Save**: Enter a name and click "Save". This saves the current text on the Content page. If a preset with the same name exists, you are asked first.
- **Load**: The content fills the Content page. It appears on the overlay after you click "Update".
- **Delete**: Click "Delete" next to a preset.

Presets do not include the current scene. Each UI pack has its own presets.

### UI library

The library lists every UI pack and shows the program version each pack was made with. If a pack cannot be used, the reason is shown, such as a newer program version being required.

- **Use**: Switches to this UI. The overlay changes at once.
- **Import**: Choose the zip file of a UI pack. Before the import, the pack's name and version are shown. If the pack contains scripts, you are warned. Import packs only from sources you trust.
- **Export**: Saves the UI pack as a zip file that you can send to others.
- **Delete**: Only imported packs can be deleted. Built-in packs cannot. A deleted pack is moved to `data/backups/`, and its content and presets are kept.

## Where data is stored

| Location | Content |
|---|---|
| `data/content/` | Text content and the current scene for each UI pack |
| `data/presets/` | Presets for each UI pack |
| `data/packs/` | Imported UI packs |
| `data/config.json` | Settings you changed, such as the panel language, the UI pack in use and the port |
| `data/backups/` | Backups of broken files and of data from older versions |

`data/` stays on your computer and is not committed to the repository. Content that older versions kept in `config/` is moved here automatically on the first start of the new version.

To change the port, write the following in `data/config.json`:

```json
{ "server": { "port": 5180 } }
```

Then restart the program.

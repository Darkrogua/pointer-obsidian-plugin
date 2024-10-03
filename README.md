# List Search for Obsidian
## Description
**List Search** allows you to replace root list items with other PREVIOUS root items from different lists. The plugin automatically displays a pencil icon button next to list items, allowing you to quickly open a modal window with editing actions. This plugin is perfect for users who work with repetitive tasks.

## Key Features
- Quickly replace a root list item with another, including all child items, regardless of their state (- [ ] or - [x]).
- Simple selection of available items for replacement using a modal window and search. The list is created by you!

## How to Use
1. Create a note titled list and list all the task items you want to replace.
2. Create notes and use root task items with the names specified in step 1.
3. While editing a task list in Markdown mode, a pencil icon (✏️) will appear next to task items.
4. Click the icon to open a modal window for selecting tasks and replacing them.
5. After selecting a task, the plugin will automatically find the most recent note with the selected item and replace the content.
6. The button will automatically disappear after a certain number of seconds (default is 3 seconds, but you can adjust this in the plugin settings).

## Settings
Currently, no settings are available!

## Usage Example

Before

- [ ] Pull-ups (machine) ✏️
    - [ ] 8х12
    - [ ] 9х12
- [ ] Bench press
    - [ ] 50х15
    - [ ] 70х12

When you hover over a task item (for example, "Pull-ups (machine)"), a pencil icon (✏️) will appear next to it. Click the icon to open a modal window to replace this task with another.

After replacement:

- [ ] Dumbbell overhead
    - [x] 2х12
    - [x] 3х12
- [ ] Bench press
    - [ ] 50х15
    - [ ] 70х12


## Manual Installation
If you want to install the plugin manually:
1. Download the plugin repository from GitHub.
2. Navigate to the Obsidian plugins folder (usually .obsidian/plugins).
3. Copy the plugin files into a separate folder inside the plugins directory.
4. Activate the plugin through the Obsidian settings.

## Compatibility
- Minimum Obsidian version: 1.6.5
- Compatible with both desktop and mobile versions of Obsidian.

##  Author
Author name: (Artem Dmitrenko)[https://github.com/Darkrogua]
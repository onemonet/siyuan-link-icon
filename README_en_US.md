## Link Icons

Provides link icons for themes that do not have built-in link icons (such as cliff-dark, toy).

Thanks to [Achuan-2 Tsundoku Theme](https://github.com/Achuan-2/siyuan-themes-tsundoku) for providing 148 icons.

Supports displaying page icons when referencing pages, thanks to the code provided by [mdzz2048](https://github.com/chenshinshi/link-icon/issues/1).

### Inserting Icons before Document References

Open the plugin settings to choose whether to insert document icons before document references. SiYuan has two types of document references:

1. **Dynamic Anchor Text**: The reference content changes with the title of the referenced document
2. **Static Anchor Text**: The reference content remains fixed, regardless of changes to the referenced document's title

Default settings:

- Dynamic anchor text icon: On (insert icon before dynamic references)
- Static anchor text icon: Off (don't insert icon before static references)
- Auto fetch link icons: Off

### Auto Fetch Link Icons

When enabled, this feature automatically fetches and caches website icons for external links, trying to get the best icon from multiple API sources (such as Google, DuckDuckGo, etc.). All fetched icons are automatically saved in your custom icon library for reuse.

### Upload Custom Icon

In the settings interface, click the "Upload Custom Icon" button. In the pop-up dialog:

1. Enter the Website Domain, for example: example.com, youtube.com, amazon.jp, etc.
2. Select the desired icon from the Select Icon options.
3. Click the Upload button to upload the icon.

All uploaded icons are saved in the `/data/public/custom-link-icons` directory.

### Icon Management and Deduplication

In the settings interface, click the "Manage Custom Icons" button to:

1. View all custom icons
2. Edit the website domain for each icon
3. Delete unwanted icons
4. Use the "Deduplicate" feature to automatically clean up duplicate icons

The icon deduplication feature automatically detects and removes duplicate items with the same domain name and icon URL, keeping your icon library organized and clean.

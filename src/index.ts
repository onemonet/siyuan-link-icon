"use strict";
// const siyuan = require("siyuan");
import * as siyuan from "siyuan";

import { manageCustomIcons, uploadCustomIcon, useDynamicStyle } from "./custom-icon";

import './style.css';

const ICON_CLASS = "plugin-link-icon";
const EVENT_LOADED_PROTYLE = 'loaded-protyle-static';

type TEventLoadedProtyle = CustomEvent<siyuan.IEventBusMap['loaded-protyle-static']>;

async function request(url, data) {
    // info(`Request: ${url}; data = ${JSON.stringify(data)}`);
    let response = await siyuan.fetchSyncPost(url, data);
    // console.log(response);
    let res = response.code === 0 ? response.data : null;
    return res;
}


async function sql(sql) {
    let sqldata = {
        stmt: sql,
    };
    let url = '/api/query/sql';
    return request(url, sqldata);
}

/**
 * 获取文档块的图标
 * @param {string} block_id
 */
async function queryDocIcon(block_id) {
    //如果不是文档块，则不添加图标
    let blocks = await sql(`select * from blocks where id = '${block_id}'`);
    if (blocks?.length === 0 || blocks[0].type !== 'd') {
        // console.log(`block ${block_id} is not a doc`)
        return null;
    }

    let response = await siyuan.fetchSyncPost(
        '/api/block/getDocInfo',
        {
            id: block_id
        }
    );
    if (response.code !== 0) {
        return null;
    }

    let icon_code = response.data.icon;
    let sub_file_cnt = response.data.subFileCount;

    // 默认文档图标
    if (icon_code === "") {
        let iconName = sub_file_cnt > 0 ? '#iconFolder' : '#iconFile';
        let dom = `<svg class="${ICON_CLASS}" style="height: 1em; width: 1em; margin-right: 0.2em;"><use xlink:href="${iconName}"></use></svg>`;
        return {
            type: 'svg',
            dom: dom,
            code: iconName
        }
    }

    let result = {
        type: "unicode",
        dom: "",
        code: icon_code
    }
    //使用了自定义的 svg 图标 vs 使用 unicode 编码的 emoji
    if (icon_code.toLowerCase().endsWith(".svg")) {
        result.type = "svg";
        result.dom = `<img alt="${icon_code}" class="emoji ${ICON_CLASS}" src="/emojis/${icon_code}" title="${icon_code}">`
    } else if (icon_code.toLowerCase().match(/\.(jpeg|jpg|png)$/)) {
        result.type = "image";
        result.dom = `<img alt="${icon_code}" class="${ICON_CLASS}" src="/emojis/${icon_code}" title="${icon_code}" style="width: 1.625em; height: 1.625em; padding-right: 3px; padding-bottom:3px; border-radius: 0.5em">`
    } else {
        result.type = "unicode";
        result.code = String.fromCodePoint(parseInt(icon_code, 16))
        result.dom = `<span data-type="text" class="${ICON_CLASS}">${result.code}</span>`
    }

    return result;
}

function isUnicodeEmoji(text) {
    const regex = /\p{Emoji}/u;
    return regex.test(text);
}

const ConfigFile = 'config.json';
const customIconsFile = 'custom-icons.json';

const simpleDialog = (args: {
    title: string, ele: HTMLElement | DocumentFragment,
    width?: string, height?: string,
    callback?: () => void;
}) => {
    const dialog = new siyuan.Dialog({
        title: args.title,
        content: `<div class="dialog-content" style="display: flex; height: 100%;"/>`,
        width: args.width,
        height: args.height,
        destroyCallback: args.callback
    });
    dialog.element.querySelector(".dialog-content").appendChild(args.ele);
    return dialog;
}

const dynamicStyle = useDynamicStyle();

export default class LinkIconPlugin extends siyuan.Plugin {

    Listener = this.listeners.bind(this);

    config = {
        InsertDocRefIcon: true,        // 动态锚文本图标
        InsertStaticRefIcon: false,    // 静态锚文本图标
        AutoFetchIcon: false
    }

    customIcons: { href: string, iconUrl: string }[] = []
    iconCache = new Map<string, string>(); // 用于缓存图标

    async onload() {
        this.initUI();

        let conf = await this.loadData(ConfigFile);
        let customIcons = await this.loadData(customIconsFile);
        this.customIcons = customIcons || [];
        if (conf) {
            for (let key in this.config) {
                let val = conf?.[key];
                if (val !== undefined) {
                    this.config[key] = val;
                }
            }
        }

        // 启动时自动去重
        if (this.deduplicateIcons()) {
            console.log("Icons deduplicated on startup");
        }

        this.customIcons.forEach(icon => {
            dynamicStyle.addIcon(icon.href, icon.iconUrl, false);
        });
        dynamicStyle.flushStyle();
        this.eventBus.on(EVENT_LOADED_PROTYLE, this.Listener);
    }

    async onunload() {
        this.eventBus.off(EVENT_LOADED_PROTYLE, this.Listener);
        dynamicStyle.clearStyle();
    }

    // 添加图标去重函数
    deduplicateIcons(): boolean {
        const uniqueIcons: typeof this.customIcons = [];
        const seen = new Set<string>();

        for (const icon of this.customIcons) {
            const key = `${icon.href}-${icon.iconUrl}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueIcons.push(icon);
            }
        }

        if (uniqueIcons.length !== this.customIcons.length) {
            this.customIcons = uniqueIcons;
            this.saveData(customIconsFile, this.customIcons);
            return true;
        }
        return false;
    }

    // 添加获取图标API函数
    async fetchIconFromAPIs(domain: string): Promise<string | null> {
        // 检查缓存
        if (this.iconCache.has(domain)) {
            return this.iconCache.get(domain)!;
        }

        const apis = [
            `https://favicon.im/${domain}`,
            `https://www.google.com/s2/favicons?domain=${domain}`,
            `https://icons.duckduckgo.com/ip3/${domain}.ico`,
        ];

        for (const api of apis) {
            try {
                const response = await fetch(api, {
                    method: "HEAD",
                    signal: AbortSignal.timeout(5000),
                });
                if (response.ok) {
                    this.iconCache.set(domain, api);
                    return api;
                }
            } catch (error) {
                console.warn(`Failed to fetch icon from ${api}:`, error);
                continue;
            }
        }

        return null;
    }

    initUI() {
        const inputDocRef = document.createElement('input');
        inputDocRef.type = 'checkbox';
        inputDocRef.className = "b3-switch fn__flex-center";
        const inputStaticRef = document.createElement('input');
        inputStaticRef.type = 'checkbox';
        inputStaticRef.className = "b3-switch fn__flex-center";
        const autoFetch = document.createElement('input');
        autoFetch.type = 'checkbox';
        autoFetch.className = "b3-switch fn__flex-center";
        const uploadBtn = document.createElement('button');
        uploadBtn.className = "b3-button fn__size200";
        uploadBtn.textContent = this.i18n.upload;
        uploadBtn.addEventListener('click', async () => {
            let ele = uploadCustomIcon((hrefName: string, url: string) => {
                dialog.destroy();
                this.onCustomIconUpload(hrefName, url);
            });
            const dialog = simpleDialog({
                title: this.i18n.upload,
                ele: ele,
                width: '700px',
            });
        });
        const manageBtn = document.createElement('button');
        manageBtn.className = "b3-button fn__size200";
        manageBtn.textContent = this.i18n.manage;
        manageBtn.addEventListener('click', async () => {
            let ele = manageCustomIcons(
                this.customIcons,
                (updatedIcons: typeof this.customIcons) => {
                    console.debug(`Updated custom icons: ${updatedIcons}`);
                    this.customIcons = updatedIcons;
                    dynamicStyle.removeAllIcons();
                    this.customIcons.forEach(icon => {
                        dynamicStyle.addIcon(icon.href, icon.iconUrl, false);
                    });
                    dynamicStyle.flushStyle();
                    this.saveData(customIconsFile, this.customIcons);
                },
                () => {
                    dialog.destroy();
                },
                this
            );
            const dialog = simpleDialog({
                title: this.i18n.manage,
                ele: ele,
                width: '400px',
            });
        });

        this.setting = new siyuan.Setting({
            width: '700px',
            height: '500px',
            confirmCallback: () => {
                this.config.InsertDocRefIcon = inputDocRef.checked;
                this.config.InsertStaticRefIcon = inputStaticRef.checked;
                this.config.AutoFetchIcon = autoFetch.checked;
                this.saveData(ConfigFile, this.config);
            }
        });
        this.setting.addItem({
            title: this.i18n.InputDocRef.title,
            description: this.i18n.InputDocRef.description,
            createActionElement: () => {
                inputDocRef.checked = this.config.InsertDocRefIcon;
                return inputDocRef;
            },
        });
        this.setting.addItem({
            title: this.i18n.InputStaticRef.title,
            description: this.i18n.InputStaticRef.description,
            createActionElement: () => {
                inputStaticRef.checked = this.config.InsertStaticRefIcon;
                return inputStaticRef;
            },
        });
        this.setting.addItem({
            title: this.i18n.AutoFetchIcon.title,
            description: this.i18n.AutoFetchIcon.description,
            createActionElement: () => {
                autoFetch.checked = this.config.AutoFetchIcon;
                return autoFetch;
            },
        });
        this.setting.addItem({
            title: this.i18n.upload,
            createActionElement: () => {
                return uploadBtn;
            }
        });
        this.setting.addItem({
            title: this.i18n.manage,
            createActionElement: () => {
                return manageBtn;
            }
        });
    }

    private async onCustomIconUpload(href: string, iconUrl: string) {
        console.debug(`Upload custom icon: ${href} -> ${iconUrl}`);

        // 检查是否已存在相同域名的图标
        const existingIconIndex = this.customIcons.findIndex(
            (icon) => icon.href === href
        );
        if (existingIconIndex !== -1) {
            // 如果已存在，先移除旧的图标文件
            const oldIconUrl = this.customIcons[existingIconIndex].iconUrl;
            if (oldIconUrl.startsWith("/public/custom-link-icons/")) {
                try {
                    await fetch("/api/file/removeFile", {
                        method: "POST",
                        body: JSON.stringify({
                            path: `/data${oldIconUrl}`,
                        }),
                    });
                } catch (error) {
                    console.warn("Failed to remove old icon:", error);
                }
            }
            // 从数组中移除旧图标
            this.customIcons.splice(existingIconIndex, 1);
        }

        // 如果是URL，需要先下载图标
        if (iconUrl.startsWith("http")) {
            try {
                const response = await fetch(iconUrl);
                if (!response.ok)
                    throw new Error(`Failed to fetch icon: ${response.statusText}`);

                const blob = await response.blob();

                // 创建canvas来转换图片格式为PNG
                const img = new Image();
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d")!;

                // 等待图片加载
                await new Promise<void>((resolve, reject) => {
                    img.onload = () => resolve();
                    img.onerror = reject;
                    img.src = URL.createObjectURL(blob);
                });

                // 设置canvas大小
                canvas.width = img.width;
                canvas.height = img.height;

                // 绘制图片
                ctx.drawImage(img, 0, 0);

                // 转换为PNG格式
                const pngBlob = await new Promise<Blob>((resolve) =>
                    canvas.toBlob((blob) => resolve(blob!), "image/png")
                );

                // 生成文件名
                const fileName = `${href.replace(/[^\w.-]/g, "_")}.png`;
                const iconPath = `/data/public/custom-link-icons/${fileName}`;

                // 使用思源API保存文件
                const formData = new FormData();
                formData.append("path", iconPath);
                formData.append("file", pngBlob, fileName);
                formData.append("isDir", "false");
                formData.append("modTime", Date.now().toString());

                const saveResponse = await fetch("/api/file/putFile", {
                    method: "POST",
                    body: formData,
                });

                if (!saveResponse.ok) {
                    const result = await saveResponse.json();
                    throw new Error(
                        `Failed to save icon: ${result.msg || "Unknown error"}`
                    );
                }

                // 更新图标URL为本地路径
                iconUrl = `/public/custom-link-icons/${fileName}`;
            } catch (error) {
                console.error("Error saving icon:", error);
                return;
            }
        }

        dynamicStyle.addIcon(href, iconUrl);
        this.customIcons.push({ href, iconUrl });
        this.saveData(customIconsFile, this.customIcons);
    }

    async listeners(event: TEventLoadedProtyle) {
        // 仅给触发加载文档的元素添加块引用图标
        let doc = event.detail?.protyle?.element;

        if (!doc) {
            console.warn("Listener failed to get protyle element");
            return;
        }

        if (this.config.InsertDocRefIcon) {
            // 处理动态锚文本（data-subtype="d"）
            let dynamic_ref_list = doc.querySelectorAll("span[data-type='block-ref'][data-subtype='d']");
            dynamic_ref_list.forEach(async (element) => {
                let block_id = element.attributes["data-id"].value;
                this.insertDocIconBefore(element, block_id);
            });
        }

        if (this.config.InsertStaticRefIcon) {
            // 处理静态锚文本（data-subtype="s"）
            let static_ref_list = doc.querySelectorAll("span[data-type='block-ref'][data-subtype='s']");
            static_ref_list.forEach(async (element) => {
                let block_id = element.attributes["data-id"].value;
                this.insertDocIconBefore(element, block_id);
            });
        }

        // 处理自动获取外链图标 - 使用CSS样式批量处理
        if (this.config.AutoFetchIcon) {
            const domainMap = new Map<string, HTMLElement[]>();
            const linkElements = doc.querySelectorAll(
                "span[data-type=a]:not([data-href^=siyuan])"
            );

            // 收集所有域名
            for (const element of linkElements) {
                const href = element.attributes["data-href"]?.value;
                if (!href) continue;

                try {
                    const urlObj = new URL(href);
                    const domain = urlObj.hostname;

                    if (!domainMap.has(domain)) {
                        domainMap.set(domain, []);
                    }
                    domainMap.get(domain)!.push(element as HTMLElement);
                } catch (error) {
                    console.warn(`Failed to parse URL ${href}:`, error);
                }
            }

            // 批量处理每个域名
            for (const [domain, elements] of domainMap.entries()) {
                const existingIcon = this.customIcons.find(
                    (icon) => icon.href === domain
                );

                if (existingIcon) {
                    // 如果已有图标，直接添加到CSS样式
                    dynamicStyle.addIcon(domain, existingIcon.iconUrl, false);
                } else {
                    // 如果没有图标，尝试获取
                    const iconUrl = await this.fetchIconFromAPIs(domain);
                    if (iconUrl) {
                        const isStillMissing = !this.customIcons.some(
                            (icon) => icon.href === domain
                        );
                        if (isStillMissing) {
                            await this.onCustomIconUpload(domain, iconUrl);
                        }
                    }
                }
            }

            // 批量刷新CSS样式
            dynamicStyle.flushStyle();
        }
    }

    /**
     * 
     * @param {HTMLSpanElement} element Span element
     */
    async insertDocIconBefore(element, block_id) {
        // 检查元素是否已经有图标属性
        if (element.hasAttribute('data-icon-name')) {
            return false;
        }
        
        // 获取文档图标
        let result = await queryDocIcon(block_id);
        if (result === null) {
            return false;
        }

        // 确保样式元素存在
        const styleElement = document.head.querySelector('style#plugin-link-icon-dynamic') || 
                            (() => {
                                const style = document.createElement('style');
                                style.id = 'plugin-link-icon-dynamic';
                                document.head.appendChild(style);
                                return style;
                            })();

        if (!(styleElement instanceof HTMLStyleElement)) {
            return false;
        }

        // 为元素生成唯一ID，用于CSS选择器
        const iconId = `icon-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        element.setAttribute('data-icon-id', iconId);

        // 添加数据属性，CSS将使用这些属性来显示图标
        if (result.type === 'svg' && result.code.startsWith('#icon')) {
            // 思源内置图标
            element.setAttribute('data-icon-name', result.code);
        } else if (result.type === 'svg' || result.type === 'image') {
            // Emoji或其他图像
            const iconPath = result.code || (result.dom.match(/src=['"](.*?)['"]/)?.[1] || '');
            element.setAttribute('data-icon-name', 'custom');

            // 为自定义图标生成CSS
            const cssRule = `.protyle-wysiwyg [data-node-id] span[data-type='block-ref'][data-icon-id="${iconId}"]::before { 
                background-image: url("/emojis/${iconPath}");
                vertical-align: text-bottom;
            }`;

            // 添加CSS规则
            styleElement.textContent = `${styleElement.textContent || ''}\n${cssRule}`;
        } else if (result.type === 'unicode') {
            // Unicode表情符号
            element.setAttribute('data-icon-name', 'emoji');

            // 为Unicode emoji生成CSS
            const cssRule = `.protyle-wysiwyg [data-node-id] span[data-type='block-ref'][data-icon-id="${iconId}"]::before { 
                content: "${result.code}"; 
                background-image: none;
                font-family: 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif;
                vertical-align: baseline;
            }`;

            // 添加CSS规则
            styleElement.textContent = `${styleElement.textContent || ''}\n${cssRule}`;
        }
        
        return true;
    }
}

/*
 * Copyright (c) 2024 by frostime. All Rights Reserved.
 * @Author       : frostime
 * @Date         : 2024-09-14 19:10:09
 * @FilePath     : /src/custom-icon.ts
 * @LastEditTime : 2024-10-09 16:44:07
 * @Description  : 
 */
import { showMessage, type Plugin } from 'siyuan';
type Href = string;
type IconUrl = string;
type CSSCode = string;

/**************************
 * @returns 动态样式相关函数
 *   - addIcon(href: Href, url: IconUrl): void; // 添加图标
 *   - removeIcon(href: Href): void; // 移除图标
 *   - clearStyle(id: string): void; // 清除样式
 **************************/
export const useDynamicStyle = (styleId = 'custom-icon-style') => {
    /**
     * 创建 CSS 样式模板
     * @param href 链接地址
     * @param url 图标 URL
     * @returns 返回生成的 CSS 规则
     */
    const template = (href: Href, url: IconUrl) => `
.protyle-wysiwyg [data-node-id] span[data-type~='a'][data-href *="${href}"]:not(:empty)::before,
.protyle-wysiwyg [data-node-id] span[data-type~='url'][data-href *="${href}"]:not(:empty)::before,
.protyle-wysiwyg [data-node-id] a[href *="${href}"]::before,
.b3-typography a[href *="${href}"]::before{
    content: "";
    background-image: url('${url}');
}
` as CSSCode;

    let customStyles: Record<Href, CSSCode> = {};

    /**
     * 更新样式
     * @param css 样式内容
     */
    const _updateStyle = (css: string) => {
        const element = document.getElementById(styleId);
        if (element) {
            element.innerHTML = css;
        } else {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = css;
            document.head.appendChild(style);
        }
    };

    /**
     * 清除样式
     */
    const clearStyle = () => {
        const element = document.getElementById(styleId);
        if (element) {
            element.remove();
        }
    }

    /**
     * 更新图标样式
     */
    const _flushStyle = () => {
        let css = '';
        for (const href in customStyles) {
            const style = customStyles[href];
            css += style + '\n';
        }
        _updateStyle(css);
    }

    /**
     * 添加图标
     * @param href 链接地址
     * @param url 图标 URL
     */
    const addIcon = (href: Href, url: IconUrl, flushStyle = true) => {
        const style = template(href, url);
        customStyles[href] = style;
        // updateIconStyle();
        if (flushStyle) {
            _flushStyle();
        }
    }

    const removeAllIcons = () => {
        customStyles = {};
    }

    /**
     * 移除图标
     * @param href 链接地址
     */
    const removeIcon = (href: Href) => {
        if (customStyles[href]) {
            delete customStyles[href];
            _flushStyle();
        }
    }

    return {
        addIcon,
        removeAllIcons,
        clearStyle,
        flushStyle: _flushStyle,
    }
}

const createForm = (path: string, isDir: boolean, file: Blob | any, stream?: boolean) => {
    let form = new FormData();
    form.append('path', path);
    form.append('isDir', isDir.toString());
    form.append('modTime', Math.floor(Date.now() / 1000).toString());
    if (file instanceof Blob && !stream) {
        form.append('file', file);
    } else {
        form.append('file', new Blob([file], { type: 'application/octet-stream' }));
    }

    return form;
}

const doUpload = async (file: File): Promise<IconUrl> => {
    const filename = file.name;
    let iconPath = `/data/public/custom-link-icons/${filename}`;
    const form = createForm(iconPath, false, file);
    let url = '/api/file/putFile';
    await fetch(url, {
        method: 'POST',
        body: form
    });
    return `/public/custom-link-icons/${filename}`;
}

/**
 * 上传自定义图标的界面
 */
export const uploadCustomIcon = (uploadCallback: (hrefName: Href, url: IconUrl) => void): HTMLElement => {
    const div = document.createElement('div');
    div.className = 'custom-icon-upload';
    div.innerHTML = `
        <h3>Upload Custom Icon</h3>
        <div class="input-group">
            <label for="website-href">Website URL:</label>
            <input type="text" id="website-href" placeholder="e.g., example.com">
        </div>
        <div class="input-group">
            <label for="icon-file">Select Icon:</label>
            <input type="file" id="icon-file" accept=".png,.jpg,.svg,.ico">
        </div>
        <div id="file-preview"></div>
        <button id="upload-button" class="b3-button" disabled>Upload Icon</button>
    `;

    const hrefInput = div.querySelector('#website-href') as HTMLInputElement;
    const fileInput = div.querySelector('#icon-file') as HTMLInputElement;
    const filePreview = div.querySelector('#file-preview') as HTMLDivElement;
    const uploadButton = div.querySelector('#upload-button') as HTMLButtonElement;

    const updateUploadButtonState = () => {
        uploadButton.disabled = !(hrefInput.value.trim() && fileInput.files && fileInput.files.length > 0);
    };

    hrefInput.addEventListener('input', updateUploadButtonState);
    fileInput.addEventListener('change', () => {
        updateUploadButtonState();
        filePreview.innerHTML = '';
        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.style.maxWidth = '100px';
                img.style.maxHeight = '100px';
                filePreview.appendChild(img);
            } else {
                filePreview.textContent = `File selected: ${file.name}`;
            }
        }
    });

    uploadButton.addEventListener('click', async () => {
        if (fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            try {
                const iconUrl = await doUpload(file);
                uploadCallback(hrefInput.value.trim(), iconUrl);
                showMessage('Icon uploaded successfully!');
                hrefInput.value = '';
                fileInput.value = '';
                filePreview.innerHTML = '';
                updateUploadButtonState();
            } catch (error) {
                console.error('Upload failed:', error);
                showMessage('Upload failed. Please try again.');
            }
        }
    });

    return div;
};


export const manageCustomIcons = (
    customIcons: { href: string; iconUrl: string }[],
    updatedCustomIcons: (customIcons: { href: string; iconUrl: string }[]) => void,
    closeCallback: () => void,
    pluginInstance?: any
): HTMLElement => {
    const container = document.createElement('div');
    container.className = 'custom-icon-manager';

    customIcons = [...customIcons];

    Object.assign(container.style, {
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        padding: '0 20px',
        gap: '15px',
        height: '600px', // 设置固定高度为600px
        minHeight: '600px', // 设置最小高度为600px
    });

    // 添加搜索框
    const searchContainer = document.createElement('div');
    Object.assign(searchContainer.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '10px',
    });

    const searchLabel = document.createElement('label');
    searchLabel.textContent = '搜索:';
    searchLabel.style.fontWeight = 'bold';

    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.placeholder = '输入域名或关键词... (支持模糊搜索)';
    Object.assign(searchInput.style, {
        flex: 1,
        padding: '8px 12px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        fontSize: '14px',
    });

    searchContainer.appendChild(searchLabel);
    searchContainer.appendChild(searchInput);
    container.appendChild(searchContainer);

    // 添加统计信息
    const statsContainer = document.createElement('div');
    Object.assign(statsContainer.style, {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px',
        fontSize: '12px',
        color: '#666',
    });

    const totalCount = document.createElement('span');
    const visibleCount = document.createElement('span');
    
    statsContainer.appendChild(totalCount);
    statsContainer.appendChild(visibleCount);
    container.appendChild(statsContainer);

    const deleteList: string[] = [];

    // 创建一个可滚动的容器
    const iconListContainer = document.createElement('div');
    Object.assign(iconListContainer.style, {
        overflowY: 'auto',
        maxHeight: '450px', // 在600px容器中留出空间给搜索框、统计信息和保存按钮
        minHeight: '200px', // 设置最小高度
        display: 'flex',
        flexDirection: 'column',
        gap: '0px', // 移除gap，因为我们在每个item中已经设置了gap
        marginBottom: '15px',
        position: 'relative', // 添加相对定位
        flex: 1, // 让滚动容器占据剩余空间
    });
    container.appendChild(iconListContainer);

    // 虚拟滚动相关变量
    const ITEM_HEIGHT = 35; // 每个图标项的高度（包含gap）
    const BUFFER_SIZE = 10; // 缓冲区大小
    let scrollTop = 0;
    let filteredIcons: typeof customIcons = [];
    let visibleRange = { start: 0, end: 0 };

    const createIconElement = (icon: { href: string; iconUrl: string }, index: number) => {
        const iconElement = document.createElement('div');
        iconElement.className = 'custom-icon-item';
        Object.assign(iconElement.style, {
            display: 'flex',
            gap: '15px',
            alignItems: 'center',
            height: '35px', // 固定高度
            minHeight: '35px', // 确保最小高度
        });
        iconElement.innerHTML = `
            <img src="${icon.iconUrl}" alt="Custom Icon" class="custom-icon-preview" style="height: 25px; width: 25px; object-fit: contain;">
            <input type="text" class="custom-icon-href" value="${icon.href}" style="flex: 1; padding: 4px 8px; border: 1px solid #ddd; border-radius: 3px;">
            <button class="custom-icon-delete b3-button b3-button--outline" style="padding: 4px 8px; font-size: 12px;">Delete</button>
        `;

        const hrefInput = iconElement.querySelector('.custom-icon-href') as HTMLInputElement;
        const deleteButton = iconElement.querySelector('.custom-icon-delete') as HTMLButtonElement;

        hrefInput.addEventListener('change', () => {
            customIcons[index].href = hrefInput.value;
        });

        deleteButton.addEventListener('click', () => {
            const icon = customIcons[index];
            deleteList.push(icon.iconUrl);
            customIcons.splice(index, 1);
            // 重新渲染以更新索引
            renderIcons(searchInput.value);
        });

        return iconElement;
    };

    const updateVisibleRange = () => {
        const containerHeight = iconListContainer.clientHeight;
        const start = Math.floor(scrollTop / ITEM_HEIGHT);
        const end = Math.min(start + Math.ceil(containerHeight / ITEM_HEIGHT) + BUFFER_SIZE, filteredIcons.length);
        
        visibleRange = { start, end };
    };

    const renderVisibleIcons = () => {
        iconListContainer.innerHTML = '';
        
        // 添加顶部占位符
        if (visibleRange.start > 0) {
            const topSpacer = document.createElement('div');
            Object.assign(topSpacer.style, {
                height: `${visibleRange.start * ITEM_HEIGHT}px`,
                flexShrink: '0',
                width: '100%',
            });
            iconListContainer.appendChild(topSpacer);
        }

        // 渲染可见的图标
        for (let i = visibleRange.start; i < visibleRange.end; i++) {
            const icon = filteredIcons[i];
            const originalIndex = customIcons.indexOf(icon);
            const iconElement = createIconElement(icon, originalIndex);
            iconListContainer.appendChild(iconElement);
        }

        // 添加底部占位符
        if (visibleRange.end < filteredIcons.length) {
            const bottomSpacer = document.createElement('div');
            Object.assign(bottomSpacer.style, {
                height: `${(filteredIcons.length - visibleRange.end) * ITEM_HEIGHT}px`,
                flexShrink: '0',
                width: '100%',
            });
            iconListContainer.appendChild(bottomSpacer);
        }
    };

    const renderIcons = (filterText: string = '') => {
        // 显示搜索中状态（当图标数量较多时）
        if (filterText && customIcons.length > 100) {
            totalCount.textContent = `总计: ${customIcons.length} 个图标`;
            visibleCount.textContent = '搜索中...';
        }

        // 使用setTimeout让UI有机会更新搜索状态
        setTimeout(() => {
            // 智能搜索：支持多个关键词
            const searchTerms = filterText.toLowerCase().split(/\s+/).filter(term => term.length > 0);
            
            if (searchTerms.length === 0) {
                // 无搜索条件，显示所有图标
                filteredIcons = [...customIcons];
            } else {
                // 过滤图标：所有搜索词都必须匹配
                filteredIcons = customIcons.filter(icon => {
                    const href = icon.href.toLowerCase();
                    return searchTerms.every(term => href.includes(term));
                });
            }

            // 更新统计信息
            totalCount.textContent = `总计: ${customIcons.length} 个图标`;
            visibleCount.textContent = `显示: ${filteredIcons.length} 个图标`;

            // 重置滚动位置
            scrollTop = 0;
            iconListContainer.scrollTop = 0;

            // 更新可见范围
            updateVisibleRange();
            
            // 渲染可见图标
            renderVisibleIcons();
        }, 0);
    };

    // 滚动事件处理
    let scrollTimeout: number;
    iconListContainer.addEventListener('scroll', () => {
        scrollTop = iconListContainer.scrollTop;
        
        // 防抖处理
        clearTimeout(scrollTimeout);
        scrollTimeout = window.setTimeout(() => {
            updateVisibleRange();
            renderVisibleIcons();
        }, 16); // 约60fps
    });

    // 搜索功能 - 添加防抖
    let searchTimeout: number;
    searchInput.addEventListener('input', (e) => {
        const filterText = (e.target as HTMLInputElement).value;
        
        clearTimeout(searchTimeout);
        searchTimeout = window.setTimeout(() => {
            renderIcons(filterText);
        }, 300); // 300ms防抖
    });

    // 初始渲染
    renderIcons();

    const saveButton = document.createElement('button');
    saveButton.className = 'b3-button b3-button--text';
    saveButton.textContent = 'Save Changes';
    saveButton.addEventListener('click', async () => {
        updatedCustomIcons([...customIcons]);
        let deleteTasks = [];
        for (const iconUrl of deleteList) {
            deleteTasks.push(fetch('/api/file/removeFile', {
                method: 'POST',
                body: JSON.stringify({
                    path: `/data${iconUrl}`
                })
            }));
        }
        await Promise.all(deleteTasks);
        closeCallback();
        showMessage('Custom icons updated successfully!');
    });

    container.appendChild(saveButton);

    return container;
};

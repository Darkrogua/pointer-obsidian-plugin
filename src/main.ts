import { Plugin, MarkdownView, Modal, App, Notice, TFile } from 'obsidian';
import { EditorView } from '@codemirror/view';

export default class ListSearchPlugin extends Plugin {
    async onload() {
        console.log("List Search Plugin loaded");

        this.registerEvent(this.app.workspace.on('layout-change', () => {
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);

            if (view && view.getMode() === 'source') {
                console.log("MarkdownView in source mode detected");

                // Подключаем стили
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = '/styles.css'; // Укажите путь к вашему CSS-файлу
                document.head.appendChild(link);

                // Получаем доступ к CodeMirror 6
                // @ts-expect-error – Obsidian не имеет типов для CM6
                const editorView = view.editor.cm as EditorView;
                console.log("CodeMirror editor detected", editorView);

                this.registerDomEvent(document, 'keyup', () => {
                    const cursor = editorView.state.selection.main.head;
                    const line = editorView.state.doc.lineAt(cursor).text;

                    const indentLevel = line.search(/\S/);

                    if ((line.trim().startsWith('-') || line.trim().match(/^\d+\./)) && indentLevel === 0) {
                        const existingButton = document.querySelector('.list-action-button');
                        if (existingButton) existingButton.remove();

                        const coords = editorView.coordsAtPos(cursor);
                        if (coords) {
                            const button = document.createElement('button');
                            button.textContent = "Изменить";
                            button.classList.add('list-action-button');
                            button.style.position = 'absolute';
                            button.style.left = `${coords.left + 20}px`;
                            button.style.top = `${coords.top - 10}px`;

                            button.onclick = async () => {
                                const exerciseList = await this.loadExerciseList();
                                new ExerciseModal(this.app, exerciseList, view).open();
                                button.style.display = 'none';
                            };

                            document.body.appendChild(button);
                        }
                    } else {
                        const existingButton = document.querySelector('.list-action-button');
                        if (existingButton) existingButton.remove();
                    }
                });
            }
        }));
    }

    async loadExerciseList(): Promise<string[]> {
        const filePath = 'Тренировки/list-exercise.md';
        const file = this.app.vault.getAbstractFileByPath(filePath);

        if (file && file instanceof TFile) {
            const fileContent = await this.app.vault.read(file);
            return fileContent.split('\n').map(line => line.replace(/^- /, '').trim()).filter(line => line.length > 0);
        } else {
            new Notice(`Файл ${filePath} не найден`);
            return [];
        }
    }

    // Добавление поиска свежего файла и замены родительского элемента
    async findFreshestFile(searchTerm: string): Promise<TFile | null> {
        const files = this.app.vault.getFiles().filter(f => f.path.startsWith('Тренировки/') && f.extension === 'md');
        let freshestFile: TFile | null = null;
        let freshestDate: Date | null = null;

        for (const file of files) {
            const content = await this.app.vault.read(file);
            const dateMatch = content.match(/Дата: (\d{4}-\d{2}-\d{2})/);  // Предполагаем, что дата указана в формате "Дата: YYYY-MM-DD"
            if (dateMatch) {
                const fileDate = new Date(dateMatch[1]);
                if (!freshestDate || fileDate > freshestDate) {
                    freshestDate = fileDate;
                    freshestFile = file;
                }
            }
        }

        if (freshestFile && freshestFile instanceof TFile) {
            const fileContent = await this.app.vault.read(freshestFile);
            if (fileContent.includes(searchTerm)) {
                return freshestFile;
            }
        }

        return null;
    }

    async replaceInCurrentFile(freshestFile: TFile, searchTerm: string): Promise<boolean> {
        const currentView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!currentView || !currentView.file) {
            new Notice('Ошибка: не удалось найти текущий файл.');
            return false;
        }

        const currentFile = currentView.file;
        const currentContent = await this.app.vault.read(currentFile);
        const freshestContent = await this.app.vault.read(freshestFile);

        // Шаг 1. Ищем родительский элемент и его дочерние элементы в свежем файле
        const searchRegexInFreshest = new RegExp(`^\\s*[-*]\\s+\\[.\\]\\s+${searchTerm}`, 'gm');
        const parentMatchInFreshest = searchRegexInFreshest.exec(freshestContent);

        if (!parentMatchInFreshest) {
            new Notice(`Не удалось найти элемент ${searchTerm} в свежем файле.`);
            return false;
        }

        const parentIndexInFreshest = parentMatchInFreshest.index;
        const linesInFreshest = freshestContent.slice(parentIndexInFreshest).split('\n');
        let freshestBlock = [linesInFreshest[0]]; // Начинаем с родительской строки в свежем файле

        // Идем по строкам, начиная с первой после родителя в свежем файле
        for (let i = 1; i < linesInFreshest.length; i++) {
            const line = linesInFreshest[i];
            if (/^\s{1,}[-*]\s+\[.\]/.test(line)) {
                // Это дочерний элемент с отступом, добавляем его
                freshestBlock.push(line);
            } else if (/^\s*[-*]\s+\[.\]/.test(line)) {
                // Это новый родительский элемент, заканчиваем
                break;
            }
        }

        // Шаг 2. Заменяем [x] на [ ] в блоке из свежего файла
        const updatedFreshestBlock = freshestBlock.map(line => line.replace(/\[x\]/g, '[ ]'));
        const blockToReplaceWith = updatedFreshestBlock.join('\n');


        // Шаг 3. Заменяем текущий выбранный блок в заметке на этот блок
        const searchRegexInCurrent = new RegExp(`^\\s*[-*]\\s+\\[.\\]\\s+${searchTerm}`, 'gm');
        const newContent = currentContent.replace(searchRegexInCurrent, blockToReplaceWith);

        console.log("Текущее содержимое файла:", currentContent);
        console.log("Новое содержимое файла:", newContent);

        // Записываем новое содержимое в файл
        await this.app.vault.modify(currentFile, newContent);

        const updatedContent = await this.app.vault.read(currentFile);
        if (updatedContent === newContent) {
            console.log("Файл успешно обновлен.");
            return true;
        } else {
            console.log("Ошибка при обновлении файла.");
            return false;
        }
    }


    onunload() {
        const existingButton = document.querySelector('.list-action-button');
        if (existingButton) existingButton.remove();
    }
}

// Модалка с поиском и возможностью выбора
class ExerciseModal extends Modal {
    exerciseList: string[];
    view: MarkdownView;

    constructor(app: App, exerciseList: string[], view: MarkdownView) {
        super(app);
        this.exerciseList = exerciseList;
        this.view = view;
    }

    onOpen() {
        const { contentEl } = this;

        contentEl.createEl('h2', { text: 'Список упражнений' });

        const searchInput = contentEl.createEl('input', { type: 'text', placeholder: 'Поиск...' });
        const ul = contentEl.createEl('ul');

        const renderList = () => {
            ul.empty();
            this.exerciseList.forEach(exercise => {
                const li = ul.createEl('li', { text: exercise });

                li.onclick = async () => {
                    const freshestFile = await (this.app as any).plugins.plugins.pointer.findFreshestFile(exercise);
                    if (freshestFile) {
                        new Notice(`Свежий файл найден: ${freshestFile.path}`);
                        await (this.app as any).plugins.plugins.pointer.replaceInCurrentFile(freshestFile, exercise);
                    } else {
                        new Notice(`Файл с упражнением ${exercise} не найден.`);
                    }
                };
            });
        };

        searchInput.oninput = () => {
            const searchValue = searchInput.value.toLowerCase();
            this.exerciseList = this.exerciseList.filter(exercise =>
                exercise.toLowerCase().includes(searchValue)
            );
            renderList();
        };

        renderList();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

import { Plugin, PluginSettingTab, Setting, MarkdownView, Modal, App, Notice, TFile } from 'obsidian';
import { EditorView } from '@codemirror/view';


export default class ListSearchPlugin extends Plugin {

    // Добавляем переменную для хранения информации о родительском элементе
    parentElement: { text: string, position: number } | null = null;
    async onload() {
        console.log("List Search Plugin loaded");

        this.registerEvent(this.app.workspace.on('layout-change', () => {
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);

            if (view && view.getMode() === 'source') {
                // Подключаем стили
                if (!document.querySelector(`link[href="/styles.css"]`)) {
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = '/styles.css'; // Укажите путь к вашему CSS-файлу
                    document.head.appendChild(link);
                }

                // Получаем доступ к CodeMirror 6
                // @ts-expect-error – Obsidian не имеет типов для CM6
                const editorView = view.editor.cm as EditorView;


                this.registerDomEvent(document, 'keyup', () => {
                    const cursor = editorView.state.selection.main.head;
                    const line = editorView.state.doc.lineAt(cursor).text;
                    const indentLevel = line.search(/\S/);

                    // Проверяем, является ли строка родительским элементом
                    if ((line.trim().startsWith('-') || line.trim().match(/^\d+\./)) && indentLevel === 0) {
                        const existingButton = document.querySelector('.list-action-button');
                        if (existingButton) existingButton.remove();

                        const coords = editorView.coordsAtPos(cursor);

                        if (coords) {
                            const button = document.createElement('button');
                            button.innerHTML = "&#9998;";
                            button.classList.add('list-action-button');
                            button.style.left = `${coords.left + 20}px`;
                            button.style.top = `${coords.top - 10}px`;


                            // Сохраняем родительский элемент (его текст и позицию)
                            this.parentElement = {
                                text: line.replace(/^\s*[-*]\s+\[.\]\s*/, '').trim(),
                                position: cursor
                            };

                            // Добавляем таймер, чтобы кнопка исчезла через 3 секунды
                            setTimeout(() => {
                                if (button) button.remove();
                            }, 3000); // 3000 миллисекунд = 3 секунды

                            button.onclick = async () => {
                                const exerciseList = await this.loadExerciseList();
                                new ExerciseModal(this.app, exerciseList, view, this.parentElement).open(); // Передаем родительский элемент в модалку
                                button.remove();
                            };

                            document.body.appendChild(button);
                        }
                    } else {
                        const existingButton = document.querySelector('.list-action-button');
                        if (existingButton) existingButton.remove();

                        // Очищаем сохраненный родительский элемент, если курсор перемещен с него
                        this.parentElement = null;
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

            // Регулярное выражение для поиска точного совпадения слова
            const searchRegex = new RegExp(`^\\s*[-*]\\s+\\[.\\]\\s+${searchTerm}\\s*$`, 'gm');

            // Проверяем, содержит ли файл строку с искомым словом без дополнительных уточнений
            if (searchRegex.test(content) && dateMatch) {
                const fileDate = new Date(dateMatch[1]);

                // Сравниваем дату файла с самой свежей датой
                if (!freshestDate || fileDate > freshestDate) {
                    freshestDate = fileDate;
                    freshestFile = file;
                }
            }
        }

        return freshestFile;
    }


    async replaceInCurrentFile(freshestFile: TFile, searchTerm: string, parentElement: { text: string, position: number }): Promise<boolean> {
        const currentView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!currentView || !currentView.file) {
            new Notice('Ошибка: не удалось найти текущий файл.');
            return false;
        }

        const currentFile = currentView.file;
        const currentContent = await this.app.vault.read(currentFile);
        const freshestContent = await this.app.vault.read(freshestFile);

        // Шаг 1. Ищем родительский элемент и его дочерние элементы в свежем файле
        let freshestBlock = this.extractBlock(freshestContent, searchTerm);

        // Шаг 2. Заменяем [x] на [ ] в блоке из свежего файла
        const updatedFreshestBlock = freshestBlock.map(line => line.replace(/\[x\]/g, '[ ]'));
        const blockToReplaceWith = updatedFreshestBlock.join('\n');

        // Шаг 3. Ищем родительский элемент и его дочерние элементы в текущем файле
        let currentBlock = this.extractBlock(currentContent, parentElement.text);
        const blockToReplace = currentBlock.join('\n');

        // Шаг 4. Заменяем текущий блок в заметке на новый блок
        const newContent = currentContent.replace(blockToReplace, blockToReplaceWith);

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


    /**
     * Функция для извлечения родительского элемента и его дочерних элементов.
     * @param {string} content - Текст, содержащий элементы для поиска.
     * @param {string} searchTerm - Искомое слово, которое должно содержаться в родительском элементе.
     * @returns {string[]} - Массив строк, представляющих родительский элемент и его дочерние элементы.
     */
    extractBlock(content: string, searchTerm: string): string[] {
        // Разбиваем весь контент на строки
        const lines = content.split('\n');

        // Регулярное выражение для поиска строки с родительским элементом
        const searchRegex = new RegExp(`^\\s*[-*]\\s+\\[.\\]\\s+${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);

        // Ищем индекс родительского элемента
        let parentIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (searchRegex.test(lines[i])) {
                parentIndex = i;
                break;
            }
        }

        // Если родительский элемент не найден, возвращаем пустой массив
        if (parentIndex === -1) {
            new Notice(`Не удалось найти элемент "${searchTerm}" в тексте.`);
            return [];
        }

        const block: string[] = [lines[parentIndex]]; // Добавляем родительскую строку как первую строку блока

        // Идем по строкам после родителя и собираем дочерние элементы (по отступам)
        const parentIndentLevel = lines[parentIndex].search(/\S/);

        for (let i = parentIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            const currentIndentLevel = line.search(/\S/);

            // Если отступ больше родительского, добавляем как дочерний элемент
            if (currentIndentLevel > parentIndentLevel) {
                block.push(line);
            } else if (currentIndentLevel <= parentIndentLevel && line.trim().startsWith('-')) {
                // Если встречаем новый родительский элемент с таким же уровнем отступа, прерываем цикл
                break;
            }
        }

        return block;
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
    parentElement: { text: string, position: number } | null;

    constructor(app: App, exerciseList: string[], view: MarkdownView, parentElement: { text: string, position: number } | null) {
        super(app);
        this.exerciseList = exerciseList;
        this.view = view;
        this.parentElement = parentElement; // Сохраняем родительский элемент
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
                    if (!this.parentElement) {
                        new Notice("Ошибка: не удалось найти родительский элемент.");
                        return;
                    }

                    // Получаем текущий открытый файл
                    const activeFile = this.app.workspace.getActiveFile();
                    if (!activeFile) {
                        new Notice('Ошибка: не удалось найти текущий файл.');
                        return;
                    }

                    // Ищем свежий файл с этим упражнением
                    const freshestFile = await (this.app as any).plugins.plugins.pointer.findFreshestFile(exercise);

                    if (freshestFile) {
                        // Проверяем, является ли свежий файл текущим открытым файлом
                        if (freshestFile.path === activeFile.path) {
                            new Notice(`Это упражнение уже есть в тренировке.`);
                        } else {
                            new Notice(`Свежий файл найден: ${freshestFile.path}`);

                            // Заменяем родительский элемент в текущем файле содержимым из свежего файла
                            await (this.app as any).plugins.plugins.pointer.replaceInCurrentFile(freshestFile, exercise, this.parentElement);
                        }
                    } else {
                        new Notice(`Файл с упражнением ${exercise} не найден.`);
                    }

                    // Закрываем модалку после замены
                    this.close();
                };
            });
        };

        // Обработчик ввода в строке поиска
        searchInput.oninput = () => {
            const searchValue = searchInput.value.toLowerCase();
            const filteredList = this.exerciseList.filter(exercise =>
                exercise.toLowerCase().includes(searchValue)
            );
            this.exerciseList = filteredList;
            renderList();
        };

        renderList();
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}


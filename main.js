"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
class ListSearchPlugin extends obsidian_1.Plugin {
    constructor() {
        super(...arguments);
        // Добавляем переменную для хранения информации о родительском элементе
        this.parentElement = null;
    }
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("List Search Plugin loaded");
            this.registerEvent(this.app.workspace.on('layout-change', () => {
                const view = this.app.workspace.getActiveViewOfType(obsidian_1.MarkdownView);
                if (view && view.getMode() === 'source') {
                    console.log("MarkdownView in source mode detected");
                    // Подключаем стили
                    const link = document.createElement('link');
                    link.rel = 'stylesheet';
                    link.href = '/styles.css'; // Укажите путь к вашему CSS-файлу
                    document.head.appendChild(link);
                    // Получаем доступ к CodeMirror 6
                    // @ts-expect-error – Obsidian не имеет типов для CM6
                    const editorView = view.editor.cm;
                    console.log("CodeMirror editor detected", editorView);
                    this.registerDomEvent(document, 'keyup', () => {
                        const cursor = editorView.state.selection.main.head;
                        const line = editorView.state.doc.lineAt(cursor).text;
                        const indentLevel = line.search(/\S/);
                        // Проверяем, является ли строка родительским элементом
                        if ((line.trim().startsWith('-') || line.trim().match(/^\d+\./)) && indentLevel === 0) {
                            const existingButton = document.querySelector('.list-action-button');
                            if (existingButton)
                                existingButton.remove();
                            const coords = editorView.coordsAtPos(cursor);
                            if (coords) {
                                const button = document.createElement('button');
                                button.textContent = "Изменить";
                                button.classList.add('list-action-button');
                                button.style.position = 'absolute';
                                button.style.left = `${coords.left + 20}px`;
                                button.style.top = `${coords.top - 10}px`;
                                // Сохраняем родительский элемент (его текст и позицию)
                                this.parentElement = {
                                    text: line.replace(/^\s*[-*]\s+\[.\]\s*/, '').trim(),
                                    position: cursor
                                };
                                button.onclick = () => __awaiter(this, void 0, void 0, function* () {
                                    const exerciseList = yield this.loadExerciseList();
                                    new ExerciseModal(this.app, exerciseList, view, this.parentElement).open(); // Передаем родительский элемент в модалку
                                    button.style.display = 'none';
                                });
                                document.body.appendChild(button);
                            }
                        }
                        else {
                            const existingButton = document.querySelector('.list-action-button');
                            if (existingButton)
                                existingButton.remove();
                            // Очищаем сохраненный родительский элемент, если курсор перемещен с него
                            this.parentElement = null;
                        }
                    });
                }
            }));
        });
    }
    loadExerciseList() {
        return __awaiter(this, void 0, void 0, function* () {
            const filePath = 'Тренировки/list-exercise.md';
            const file = this.app.vault.getAbstractFileByPath(filePath);
            if (file && file instanceof obsidian_1.TFile) {
                const fileContent = yield this.app.vault.read(file);
                return fileContent.split('\n').map(line => line.replace(/^- /, '').trim()).filter(line => line.length > 0);
            }
            else {
                new obsidian_1.Notice(`Файл ${filePath} не найден`);
                return [];
            }
        });
    }
    // Добавление поиска свежего файла и замены родительского элемента
    findFreshestFile(searchTerm) {
        return __awaiter(this, void 0, void 0, function* () {
            const files = this.app.vault.getFiles().filter(f => f.path.startsWith('Тренировки/') && f.extension === 'md');
            let freshestFile = null;
            let freshestDate = null;
            for (const file of files) {
                const content = yield this.app.vault.read(file);
                const dateMatch = content.match(/Дата: (\d{4}-\d{2}-\d{2})/); // Предполагаем, что дата указана в формате "Дата: YYYY-MM-DD"
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
        });
    }
    replaceInCurrentFile(freshestFile, searchTerm, parentElement) {
        return __awaiter(this, void 0, void 0, function* () {
            const currentView = this.app.workspace.getActiveViewOfType(obsidian_1.MarkdownView);
            if (!currentView || !currentView.file) {
                new obsidian_1.Notice('Ошибка: не удалось найти текущий файл.');
                return false;
            }
            const currentFile = currentView.file;
            const currentContent = yield this.app.vault.read(currentFile);
            const freshestContent = yield this.app.vault.read(freshestFile);
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
            console.log("Текущее содержимое файла:", currentContent);
            console.log("Новое содержимое файла:", newContent);
            // Записываем новое содержимое в файл
            yield this.app.vault.modify(currentFile, newContent);
            const updatedContent = yield this.app.vault.read(currentFile);
            if (updatedContent === newContent) {
                console.log("Файл успешно обновлен.");
                return true;
            }
            else {
                console.log("Ошибка при обновлении файла.");
                return false;
            }
        });
    }
    /**
     * Функция для извлечения родительского элемента и его дочерних элементов.
     * @param {string} content - Текст, содержащий элементы для поиска.
     * @param {string} searchTerm - Искомое слово, которое должно содержаться в родительском элементе.
     * @returns {string[]} - Массив строк, представляющих родительский элемент и его дочерние элементы.
     */
    extractBlock(content, searchTerm) {
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
            new obsidian_1.Notice(`Не удалось найти элемент "${searchTerm}" в тексте.`);
            return [];
        }
        const block = [lines[parentIndex]]; // Добавляем родительскую строку как первую строку блока
        // Идем по строкам после родителя и собираем дочерние элементы (по отступам)
        const parentIndentLevel = lines[parentIndex].search(/\S/);
        for (let i = parentIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            const currentIndentLevel = line.search(/\S/);
            // Если отступ больше родительского, добавляем как дочерний элемент
            if (currentIndentLevel > parentIndentLevel) {
                block.push(line);
            }
            else if (currentIndentLevel <= parentIndentLevel && line.trim().startsWith('-')) {
                // Если встречаем новый родительский элемент с таким же уровнем отступа, прерываем цикл
                break;
            }
        }
        return block;
    }
    onunload() {
        const existingButton = document.querySelector('.list-action-button');
        if (existingButton)
            existingButton.remove();
    }
}
exports.default = ListSearchPlugin;
// Модалка с поиском и возможностью выбора
class ExerciseModal extends obsidian_1.Modal {
    constructor(app, exerciseList, view, parentElement) {
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
                li.onclick = () => __awaiter(this, void 0, void 0, function* () {
                    if (!this.parentElement) {
                        new obsidian_1.Notice("Ошибка: не удалось найти родительский элемент.");
                        return;
                    }
                    // Получаем текущий открытый файл
                    const activeFile = this.app.workspace.getActiveFile();
                    if (!activeFile) {
                        new obsidian_1.Notice('Ошибка: не удалось найти текущий файл.');
                        return;
                    }
                    // Ищем свежий файл с этим упражнением
                    const freshestFile = yield this.app.plugins.plugins.pointer.findFreshestFile(exercise);
                    if (freshestFile) {
                        // Проверяем, является ли свежий файл текущим открытым файлом
                        if (freshestFile.path === activeFile.path) {
                            new obsidian_1.Notice(`Это упражнение уже есть в тренировке.`);
                        }
                        else {
                            new obsidian_1.Notice(`Свежий файл найден: ${freshestFile.path}`);
                            // Заменяем родительский элемент в текущем файле содержимым из свежего файла
                            yield this.app.plugins.plugins.pointer.replaceInCurrentFile(freshestFile, exercise, this.parentElement);
                        }
                    }
                    else {
                        new obsidian_1.Notice(`Файл с упражнением ${exercise} не найден.`);
                    }
                    // Закрываем модалку после замены
                    this.close();
                });
            });
        };
        // Обработчик ввода в строке поиска
        searchInput.oninput = () => {
            const searchValue = searchInput.value.toLowerCase();
            const filteredList = this.exerciseList.filter(exercise => exercise.toLowerCase().includes(searchValue));
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

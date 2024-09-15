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
                                button.onclick = () => __awaiter(this, void 0, void 0, function* () {
                                    const exerciseList = yield this.loadExerciseList();
                                    new ExerciseModal(this.app, exerciseList, view).open();
                                    button.style.display = 'none';
                                });
                                document.body.appendChild(button);
                            }
                        }
                        else {
                            const existingButton = document.querySelector('.list-action-button');
                            if (existingButton)
                                existingButton.remove();
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
                if (dateMatch) {
                    const fileDate = new Date(dateMatch[1]);
                    if (!freshestDate || fileDate > freshestDate) {
                        freshestDate = fileDate;
                        freshestFile = file;
                    }
                }
            }
            if (freshestFile && freshestFile instanceof obsidian_1.TFile) {
                const fileContent = yield this.app.vault.read(freshestFile);
                if (fileContent.includes(searchTerm)) {
                    return freshestFile;
                }
            }
            return null;
        });
    }
    replaceInCurrentFile(freshestFile, searchTerm) {
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
            const searchRegexInFreshest = new RegExp(`^\\s*[-*]\\s+\\[.\\]\\s+${searchTerm}`, 'gm');
            const parentMatchInFreshest = searchRegexInFreshest.exec(freshestContent);
            if (!parentMatchInFreshest) {
                new obsidian_1.Notice(`Не удалось найти элемент ${searchTerm} в свежем файле.`);
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
                }
                else if (/^\s*[-*]\s+\[.\]/.test(line)) {
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
    onunload() {
        const existingButton = document.querySelector('.list-action-button');
        if (existingButton)
            existingButton.remove();
    }
}
exports.default = ListSearchPlugin;
// Модалка с поиском и возможностью выбора
class ExerciseModal extends obsidian_1.Modal {
    constructor(app, exerciseList, view) {
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
                li.onclick = () => __awaiter(this, void 0, void 0, function* () {
                    const freshestFile = yield this.app.plugins.plugins.pointer.findFreshestFile(exercise);
                    if (freshestFile) {
                        new obsidian_1.Notice(`Свежий файл найден: ${freshestFile.path}`);
                        yield this.app.plugins.plugins.pointer.replaceInCurrentFile(freshestFile, exercise);
                    }
                    else {
                        new obsidian_1.Notice(`Файл с упражнением ${exercise} не найден.`);
                    }
                });
            });
        };
        searchInput.oninput = () => {
            const searchValue = searchInput.value.toLowerCase();
            this.exerciseList = this.exerciseList.filter(exercise => exercise.toLowerCase().includes(searchValue));
            renderList();
        };
        renderList();
    }
    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

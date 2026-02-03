/**
 * Quiz Engine
 * Reusable quiz system for resource pages
 */

class QuizEngine {
    constructor(containerId, questions) {
        this.container = document.getElementById(containerId);
        this.questions = questions;
        this.currentQuestion = 0;
        this.score = 0;
        this.answers = [];
        this.init();
    }

    init() {
        if (!this.container || !this.questions || this.questions.length === 0) return;

        this.render();
        this.setupEventListeners();
    }

    render() {
        this.container.innerHTML = `
            <div class="quiz-header">
                <h3>Test Your Knowledge</h3>
                <div class="quiz-progress">
                    <div class="quiz-progress-bar" style="width: ${(this.currentQuestion / this.questions.length) * 100}%"></div>
                </div>
                <p>Question ${this.currentQuestion + 1} of ${this.questions.length}</p>
            </div>
            <div class="quiz-question" id="quiz-question">
                ${this.renderQuestion()}
            </div>
            <div class="quiz-navigation" id="quiz-navigation">
                ${this.renderNavigation()}
            </div>
        `;
    }

    renderQuestion() {
        if (this.currentQuestion >= this.questions.length) {
            return this.renderResults();
        }

        const question = this.questions[this.currentQuestion];
        const options = question.options.map((option, index) => `
            <button class="quiz-option" data-index="${index}" data-correct="${option.correct}">
                ${option.text}
            </button>
        `).join('');

        return `
            <h4>${question.question}</h4>
            <div class="quiz-options">
                ${options}
            </div>
            <div class="quiz-feedback" id="quiz-feedback"></div>
        `;
    }

    renderNavigation() {
        if (this.currentQuestion >= this.questions.length) {
            return '';
        }

        let nav = '';
        if (this.currentQuestion > 0) {
            nav += `<button class="btn btn-secondary" id="quiz-prev">Previous</button>`;
        } else {
            nav += `<div></div>`;
        }

        if (this.currentQuestion < this.questions.length - 1) {
            nav += `<button class="btn" id="quiz-next" disabled>Next</button>`;
        } else {
            nav += `<button class="btn" id="quiz-submit" disabled>Submit Quiz</button>`;
        }

        return nav;
    }

    renderResults() {
        const percentage = Math.round((this.score / this.questions.length) * 100);
        let message = '';
        let emoji = '';

        if (percentage >= 90) {
            message = 'Excellent! You have a strong understanding of this topic.';
            emoji = '🎉';
        } else if (percentage >= 70) {
            message = 'Good job! You have a solid grasp of the material.';
            emoji = '👍';
        } else if (percentage >= 50) {
            message = 'Not bad! Review the material and try again.';
            emoji = '📚';
        } else {
            message = 'Keep learning! Review the guide and try the quiz again.';
            emoji = '💪';
        }

        return `
            <div class="quiz-results">
                <h3>Quiz Complete! ${emoji}</h3>
                <div class="quiz-score">${percentage}%</div>
                <p>You got ${this.score} out of ${this.questions.length} questions correct.</p>
                <p>${message}</p>
                <div style="margin-top: var(--spacing-xl);">
                    <button class="btn" id="quiz-restart">Take Quiz Again</button>
                </div>
            </div>
        `;
    }

    setupEventListeners() {
        // Option selection
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('quiz-option')) {
                this.selectOption(e.target);
            }
        });

        // Navigation buttons
        this.container.addEventListener('click', (e) => {
            if (e.target.id === 'quiz-prev') {
                this.previousQuestion();
            } else if (e.target.id === 'quiz-next') {
                this.nextQuestion();
            } else if (e.target.id === 'quiz-submit') {
                this.submitQuiz();
            } else if (e.target.id === 'quiz-restart') {
                this.restart();
            }
        });
    }

    selectOption(optionElement) {
        // Disable all options
        this.container.querySelectorAll('.quiz-option').forEach(opt => {
            opt.disabled = true;
            opt.classList.remove('selected');
        });

        // Mark selected option
        optionElement.classList.add('selected');
        const isCorrect = optionElement.dataset.correct === 'true';
        const optionIndex = parseInt(optionElement.dataset.index);

        // Store answer
        this.answers[this.currentQuestion] = {
            questionIndex: this.currentQuestion,
            selectedIndex: optionIndex,
            correct: isCorrect
        };

        // Show feedback
        this.showFeedback(isCorrect, optionElement);

        // Enable next/submit button
        const nextBtn = document.getElementById('quiz-next');
        const submitBtn = document.getElementById('quiz-submit');
        if (nextBtn) nextBtn.disabled = false;
        if (submitBtn) submitBtn.disabled = false;
    }

    showFeedback(isCorrect, selectedOption) {
        const feedback = document.getElementById('quiz-feedback');
        if (!feedback) return;

        // Mark correct/incorrect
        selectedOption.classList.add(isCorrect ? 'correct' : 'incorrect');

        // Highlight correct answer if wrong
        if (!isCorrect) {
            this.container.querySelectorAll('.quiz-option').forEach(opt => {
                if (opt.dataset.correct === 'true') {
                    opt.classList.add('correct');
                }
            });
        }

        // Show feedback message
        const question = this.questions[this.currentQuestion];
        feedback.className = `quiz-feedback show ${isCorrect ? 'correct' : 'incorrect'}`;
        feedback.innerHTML = isCorrect 
            ? `<strong>Correct!</strong> ${question.feedback?.correct || ''}`
            : `<strong>Incorrect.</strong> ${question.feedback?.incorrect || question.feedback?.correct || ''}`;
    }

    nextQuestion() {
        if (this.currentQuestion < this.questions.length - 1) {
            this.currentQuestion++;
            this.render();
            this.setupEventListeners();
        }
    }

    previousQuestion() {
        if (this.currentQuestion > 0) {
            this.currentQuestion--;
            this.render();
            this.setupEventListeners();
            
            // Restore previous answer state
            if (this.answers[this.currentQuestion]) {
                const answer = this.answers[this.currentQuestion];
                const options = this.container.querySelectorAll('.quiz-option');
                if (options[answer.selectedIndex]) {
                    this.selectOption(options[answer.selectedIndex]);
                }
            }
        }
    }

    submitQuiz() {
        // Calculate score
        this.score = this.answers.filter(a => a.correct).length;
        this.currentQuestion = this.questions.length; // Move past last question
        this.render();
    }

    restart() {
        this.currentQuestion = 0;
        this.score = 0;
        this.answers = [];
        this.render();
        this.setupEventListeners();
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = QuizEngine;
}

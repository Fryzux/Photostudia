from django.core.management.base import BaseCommand
import subprocess
import sys
import os


class Command(BaseCommand):
    help = 'Обучить почасовую AI-модель прогноза загрузки залов'

    def handle(self, *args, **kwargs):
        self.stdout.write('Запуск обучения почасовой AI-модели...')
        script_path = os.path.join(os.path.dirname(__file__), '..', '..', 'scripts', 'train_hourly_model.py')
        script_path = os.path.abspath(script_path)

        result = subprocess.run([sys.executable, script_path], capture_output=True, text=True)
        
        if result.stdout:
            self.stdout.write(result.stdout)
        if result.stderr:
            self.stderr.write(result.stderr)

        if result.returncode == 0:
            self.stdout.write(self.style.SUCCESS('Почасовая AI-модель успешно обучена и сохранена в ai/ai_hourly_model.pkl'))
        else:
            self.stderr.write(self.style.ERROR(f'Ошибка при обучении модели (код {result.returncode})'))

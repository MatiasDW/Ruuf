from __future__ import annotations

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("catalog", "0004_grassspecies"),
    ]

    operations = [
        migrations.AddField(
            model_name="plantcultivar",
            name="image_url",
            field=models.URLField(blank=True, help_text="URL to plant image (optional)"),
        ),
        migrations.AddField(
            model_name="grassspecies",
            name="image_url",
            field=models.URLField(blank=True, help_text="URL to grass species image (optional)"),
        ),
    ]

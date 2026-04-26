#!/bin/bash
# Script to fix common TypeScript errors

echo "Fixing TypeScript errors..."

# 1. Fix UseMiddleware imports in controllers
echo "Fixing UseMiddleware imports..."
find src/modules -name "*.controller.ts" -type f -exec sed -i 's/UseMiddleware,/UseGuards,/g' {} \;
find src/modules -name "*.controller.ts" -type f -exec sed -i 's/@UseMiddleware(RequireAuthMiddleware)/@UseGuards(AuthGuard)/g' {} \;

# 2. Fix i18nService.t() to getTranslator()
echo "Fixing i18nService.t() calls..."
find src/modules -name "*.ts" -type f -exec sed -i 's/this\.i18nService\.t(/this.i18nService.getTranslator(/g' {} \;

# 3. Fix Markup.InlineKeyboardMarkup to just Markup
echo "Fixing Markup types..."
find src/modules -name "*.ts" -type f -exec sed -i 's/Markup\.InlineKeyboardMarkup/Markup.InlineKeyboardButton[][]/g' {} \;
find src/modules -name "*.ts" -type f -exec sed -i 's/Markup\.ReplyKeyboardMarkup/Markup.KeyboardButton[][]/g' {} \;

# 4. Fix deletedAt: null to IsNull()
echo "Fixing deletedAt queries..."
find src/modules -name "*.ts" -type f -exec sed -i 's/deletedAt: null/deletedAt: IsNull()/g' {} \;

echo "Done! Please run npm run build to check remaining errors."

# PF2e Lock Pick+

Module to automate rolling Pick a Lock checks per the [Pick a Lock](https://2e.aonprd.com/Actions.aspx?ID=2412) action rules. 

> [!NOTE]
> Module is currently still in testing phase. It is mostly functional but may have bugs. Please [Report any issues](https://github.com/thejoester/pf2e-lock-pick/issues) you find!
> 
> I am also planning on updating the UI with better images and layout. 

## Features

- GM starts "Lock Pick Challenge", selects player, sets DC and required successful attemtps.
- When GM starts challenge, shows UI to player where they can choose toolkit, and roll to pick the lock.
- Uses PF2e Thievery check.
- Detects Critical success increases successful attempts by 2
- Detects Critical Failure and destroys replacement pick, or "breaks" toolkit.
  - Simply renames the toolkit to add "(broken)" to the name, once repaired with [crafting check or purchase of replacement picks](https://2e.aonprd.com/Actions.aspx?ID=2412)
- Updates lock image based on progress
- GM can update success count if player re-rolls with hero point.
- GM can resume session if window accidentally closed, and show player if player accidentally closed UI. 

## Screenshots

When GM Launches, setup UI

<img width="602" height="272" alt="image" src="https://github.com/user-attachments/assets/7d81f117-aa6b-414e-9da9-062629849d16" />


GM View (UI will be improved)

<img width="602" height="347" alt="image" src="https://github.com/user-attachments/assets/7a4bb863-2ae3-48ed-ade1-bd16adc8fd8e" />


Player View

<img width="605" height="352" alt="image" src="https://github.com/user-attachments/assets/f9924dd5-e203-48de-94b3-2a13c0cda5af" />


Lock image updates based on progress

![lock-pick-progress](https://github.com/user-attachments/assets/33bf191c-b784-4bcf-9d8e-3463bf497e1a)


## Contribute

### Art
I am hoping to get better artwork to represent the lock, perhaps different types that could be selected in settings. If you are willing to contribute to this I will be ever grateful and credit you in the module. 

### Localization
If you would like to contribute to the localization, you can do so in one of these ways: 

#### 1. Translate through [Gitlocalize](https://gitlocalize.com/repo/10577). 
Send me a request to add you as a translator on GitLocalize with your username. 

#### 2. Fork and Submit a Pull Request:
1. [Fork the repository](https://www.youtube.com/watch?v=f5grYMXbAV0) (copy main branch only).
2. Then download or copy the [en.json](https://github.com/thejoester/pf2e-lock-pick/blob/main/lang/en.json) file.
3. Rename it to the proper [language code](https://en.wikipedia.org/wiki/List_of_ISO_639_language_codes) (for example es.json for Spanish language),
4. Edit the file translating the text in quotes on the RIGHT SIDE of the colon.
5. When done upload the new language file to your fork in the **lang/** folder,
6. Click the "Contribute" button and "Open Pull Request".

#### 3. Upload file as Issue:
1. Download the [en.json](https://github.com/thejoester/pf2e-lock-pick/blob/main/lang/en.json) file,
2. Rename it to the Open up an [Issue](https://github.com/thejoester/pf2e-lock-pick/issues) and attach the file. 

## Install 
While this module is in testing phase, you can install it using the manifest URL: 
`https://github.com/thejoester/pf2e-lock-pick/releases/latest/download/module.json`

Once I am ready for release I will add it to the foundry module list. 

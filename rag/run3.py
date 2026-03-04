from mod3 import KisanExpertBot

bot = KisanExpertBot()

print("🌾 Kissan Chatbot Started (type exit to stop)\n")

while True:
    user_input = input("You: ")

    if user_input.lower() == "exit":
        break

    response = bot.chat_message(user_input)

    print("Kissan:", response)
